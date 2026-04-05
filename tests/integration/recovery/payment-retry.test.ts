import { computeNextRetryTime, shouldSkipRetries } from '@/services/retry'
import { RETRY_CONFIG } from '@/constants/retry-config'

// ── Mocks ────────────────────────────────────────────────

const mockPrisma = {
  recoveryCase: {
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  retryAttempt: {
    create: jest.fn(),
    update: jest.fn(),
  },
}

jest.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

const mockStripe = {
  invoices: {
    pay: jest.fn(),
  },
}

jest.mock('@/lib/stripe', () => ({ stripe: mockStripe }))

// Mock inngest step utilities
const createMockStep = () => ({
  run: jest.fn((_name: string, fn: () => Promise<unknown>) => fn()),
  sleepUntil: jest.fn().mockResolvedValue(undefined),
  sleep: jest.fn().mockResolvedValue(undefined),
})

// ── Helpers ──────────────────────────────────────────────

const createMockEvent = (overrides: Record<string, unknown> = {}) => ({
  data: {
    recoveryCaseId: 'rc_test_001',
    declineType: 'SOFT',
    customerTimezone: 'America/New_York',
    ...overrides,
  },
})

const createMockRecoveryCase = (overrides: Record<string, unknown> = {}) => ({
  id: 'rc_test_001',
  stripeInvoiceId: 'in_test_001',
  status: 'RETRYING',
  business: {
    id: 'biz_001',
    stripeAccountId: 'acct_test_001',
  },
  ...overrides,
})

// ── Simulated payment-retry function ─────────────────────

const simulatePaymentRetry = async (
  event: ReturnType<typeof createMockEvent>,
  step: ReturnType<typeof createMockStep>
) => {
  const { recoveryCaseId, declineType, customerTimezone } = event.data

  if (shouldSkipRetries(declineType as string)) {
    await step.run('skip-to-email', async () => {
      await mockPrisma.recoveryCase.update({
        where: { id: recoveryCaseId },
        data: { status: 'EMAILING', phase: 'EMAIL' },
      })
    })
    return { skippedToEmail: true }
  }

  await step.run('set-retrying', async () => {
    await mockPrisma.recoveryCase.update({
      where: { id: recoveryCaseId },
      data: { status: 'RETRYING' },
    })
  })

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
    const retryTime = computeNextRetryTime(customerTimezone as string, attempt)

    await step.run(`create-attempt-${attempt}`, async () => {
      await mockPrisma.retryAttempt.create({
        data: {
          recoveryCaseId,
          attemptNumber: attempt,
          scheduledAt: retryTime,
          status: 'SCHEDULED',
        },
      })
    })

    await step.sleepUntil(`wait-for-retry-${attempt}`, retryTime)

    const result = await step.run(`execute-retry-${attempt}`, async () => {
      const recoveryCase = await mockPrisma.recoveryCase.findUnique({
        where: { id: recoveryCaseId },
        include: { business: true },
      })
      if (!recoveryCase || recoveryCase.status === 'RECOVERED' || recoveryCase.status === 'CANCELLED') {
        return { cancelled: true }
      }

      await mockPrisma.retryAttempt.update({
        where: { recoveryCaseId_attemptNumber: { recoveryCaseId, attemptNumber: attempt } },
        data: { status: 'EXECUTING', executedAt: new Date() },
      })

      try {
        await mockStripe.invoices.pay(recoveryCase.stripeInvoiceId, {}, {
          stripeAccount: recoveryCase.business.stripeAccountId,
        })

        await mockPrisma.retryAttempt.update({
          where: { recoveryCaseId_attemptNumber: { recoveryCaseId, attemptNumber: attempt } },
          data: { status: 'SUCCEEDED' },
        })

        await mockPrisma.recoveryCase.update({
          where: { id: recoveryCaseId },
          data: { status: 'RECOVERED', recoveredAt: new Date(), phase: 'COMPLETE' },
        })

        return { succeeded: true }
      } catch (err: unknown) {
        const stripeErr = err as { code?: string; message?: string }
        await mockPrisma.retryAttempt.update({
          where: { recoveryCaseId_attemptNumber: { recoveryCaseId, attemptNumber: attempt } },
          data: {
            status: 'FAILED',
            failureCode: stripeErr.code ?? 'unknown',
            failureMessage: stripeErr.message ?? 'Payment retry failed',
          },
        })
        return { failed: true, code: stripeErr.code }
      }
    })

    if ((result as Record<string, unknown>).cancelled || (result as Record<string, unknown>).succeeded) {
      return result
    }
  }

  await step.run('escalate-to-email', async () => {
    await mockPrisma.recoveryCase.update({
      where: { id: recoveryCaseId },
      data: { status: 'EMAILING', phase: 'EMAIL' },
    })
  })

  return { escalatedToEmail: true }
}

// ── Tests ────────────────────────────────────────────────

describe('Payment Retry Flow', () => {
  let mockStep: ReturnType<typeof createMockStep>

  beforeEach(() => {
    jest.clearAllMocks()
    mockStep = createMockStep()
  })

  it('soft decline triggers retry scheduling', async () => {
    const event = createMockEvent({ declineType: 'SOFT' })

    mockPrisma.recoveryCase.findUnique.mockResolvedValue(createMockRecoveryCase())
    mockStripe.invoices.pay.mockRejectedValue({ code: 'insufficient_funds', message: 'Insufficient funds' })

    const result = await simulatePaymentRetry(event, mockStep)

    // Should have set status to RETRYING
    expect(mockPrisma.recoveryCase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'RETRYING' }),
      })
    )

    // Should have created retry attempts
    expect(mockPrisma.retryAttempt.create).toHaveBeenCalledTimes(RETRY_CONFIG.maxAttempts)

    // Should have scheduled sleeps
    expect(mockStep.sleepUntil).toHaveBeenCalledTimes(RETRY_CONFIG.maxAttempts)

    // After all retries fail, should escalate to email
    expect(result).toEqual({ escalatedToEmail: true })
  })

  it('hard decline skips retries and transitions to email phase', async () => {
    const event = createMockEvent({ declineType: 'HARD' })

    const result = await simulatePaymentRetry(event, mockStep)

    expect(result).toEqual({ skippedToEmail: true })
    expect(mockPrisma.recoveryCase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'EMAILING', phase: 'EMAIL' }),
      })
    )

    // No retry attempts should be created
    expect(mockPrisma.retryAttempt.create).not.toHaveBeenCalled()
    expect(mockStep.sleepUntil).not.toHaveBeenCalled()
  })

  it('successful retry marks case as RECOVERED', async () => {
    const event = createMockEvent({ declineType: 'SOFT' })

    mockPrisma.recoveryCase.findUnique.mockResolvedValue(createMockRecoveryCase())
    // First retry succeeds
    mockStripe.invoices.pay.mockResolvedValueOnce({ id: 'in_test_001', status: 'paid' })

    const result = await simulatePaymentRetry(event, mockStep)

    expect(result).toEqual({ succeeded: true })

    // Should have marked the attempt as SUCCEEDED
    expect(mockPrisma.retryAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SUCCEEDED' }),
      })
    )

    // Should have marked the case as RECOVERED
    expect(mockPrisma.recoveryCase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'RECOVERED', phase: 'COMPLETE' }),
      })
    )

    // Should only have created 1 retry attempt (stopped after success)
    expect(mockPrisma.retryAttempt.create).toHaveBeenCalledTimes(1)
  })

  it('exhausted retries transition to EMAIL phase', async () => {
    const event = createMockEvent({ declineType: 'SOFT' })

    mockPrisma.recoveryCase.findUnique.mockResolvedValue(createMockRecoveryCase())
    // All retries fail
    mockStripe.invoices.pay.mockRejectedValue({ code: 'insufficient_funds', message: 'Insufficient funds' })

    const result = await simulatePaymentRetry(event, mockStep)

    expect(result).toEqual({ escalatedToEmail: true })

    // Should have escalated to email phase
    expect(mockPrisma.recoveryCase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'EMAILING', phase: 'EMAIL' }),
      })
    )

    // All 3 attempts should have been created and executed
    expect(mockPrisma.retryAttempt.create).toHaveBeenCalledTimes(RETRY_CONFIG.maxAttempts)
    expect(mockStripe.invoices.pay).toHaveBeenCalledTimes(RETRY_CONFIG.maxAttempts)
  })

  it('stops retrying if recovery case is cancelled', async () => {
    const event = createMockEvent({ declineType: 'SOFT' })

    mockPrisma.recoveryCase.findUnique.mockResolvedValue(
      createMockRecoveryCase({ status: 'CANCELLED' })
    )

    const result = await simulatePaymentRetry(event, mockStep)

    expect(result).toEqual({ cancelled: true })
    expect(mockStripe.invoices.pay).not.toHaveBeenCalled()
  })
})
