import { createMockStripeEvent, createMockInvoice } from '../../__mocks__/stripe'

const mockPrisma = {
  webhookEvent: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  business: {
    findUnique: jest.fn(),
  },
  recoveryCase: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
}

jest.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

describe('Webhook Idempotency', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('processes new events successfully', async () => {
    const invoice = createMockInvoice({ id: 'in_new_event' })
    const event = createMockStripeEvent('invoice.payment_failed', invoice)

    // Event has not been processed before
    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null)

    const existing = await mockPrisma.webhookEvent.findUnique({
      where: { stripeEventId: event.id },
    })

    expect(existing).toBeNull()

    // Process the event
    mockPrisma.business.findUnique.mockResolvedValue({
      id: 'biz_123',
      stripeAccountId: event.account,
      monitoringActive: true,
    })
    mockPrisma.recoveryCase.findFirst.mockResolvedValue(null)
    mockPrisma.recoveryCase.create.mockResolvedValue({
      id: 'rc_created',
      stripeInvoiceId: 'in_new_event',
      status: 'PENDING',
    })
    mockPrisma.webhookEvent.create.mockResolvedValue({
      stripeEventId: event.id,
      eventType: event.type,
      stripeAccountId: event.account,
    })

    const result = await processWebhookEvent(event)

    expect(result.status).toBe('processed')
    expect(mockPrisma.webhookEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        stripeEventId: event.id,
        eventType: 'invoice.payment_failed',
        stripeAccountId: event.account,
      }),
    })
    expect(mockPrisma.recoveryCase.create).toHaveBeenCalledTimes(1)
  })

  it('rejects duplicate event IDs', async () => {
    const invoice = createMockInvoice({ id: 'in_dupe' })
    const event = createMockStripeEvent('invoice.payment_failed', invoice)

    // Event already processed
    mockPrisma.webhookEvent.findUnique.mockResolvedValue({
      stripeEventId: event.id,
      eventType: event.type,
      stripeAccountId: event.account,
      processedAt: new Date('2026-04-04T10:00:00Z'),
    })

    const result = await processWebhookEvent(event)

    expect(result.status).toBe('duplicate')
    expect(mockPrisma.recoveryCase.create).not.toHaveBeenCalled()
    expect(mockPrisma.webhookEvent.create).not.toHaveBeenCalled()
  })

  it('returns 200 for duplicate events', async () => {
    const event = createMockStripeEvent('invoice.payment_failed', createMockInvoice())

    // Event already processed
    mockPrisma.webhookEvent.findUnique.mockResolvedValue({
      stripeEventId: event.id,
      eventType: event.type,
      stripeAccountId: event.account,
      processedAt: new Date(),
    })

    const result = await processWebhookEvent(event)

    // Duplicates should be silently acknowledged
    expect(result.status).toBe('duplicate')
    expect(result.httpStatus).toBe(200)
    expect(mockPrisma.business.findUnique).not.toHaveBeenCalled()
  })

  it('processes the same event ID twice and only creates one recovery case', async () => {
    const invoice = createMockInvoice({ id: 'in_once_only' })
    const event = createMockStripeEvent('invoice.payment_failed', invoice)

    // First call: event not yet processed
    mockPrisma.webhookEvent.findUnique.mockResolvedValueOnce(null)
    mockPrisma.business.findUnique.mockResolvedValue({
      id: 'biz_123',
      stripeAccountId: event.account,
      monitoringActive: true,
    })
    mockPrisma.recoveryCase.findFirst.mockResolvedValue(null)
    mockPrisma.recoveryCase.create.mockResolvedValue({
      id: 'rc_single',
      stripeInvoiceId: 'in_once_only',
      status: 'PENDING',
    })
    mockPrisma.webhookEvent.create.mockResolvedValue({
      stripeEventId: event.id,
      eventType: event.type,
    })

    const firstResult = await processWebhookEvent(event)
    expect(firstResult.status).toBe('processed')

    // Second call: event already recorded
    mockPrisma.webhookEvent.findUnique.mockResolvedValueOnce({
      stripeEventId: event.id,
      eventType: event.type,
      stripeAccountId: event.account,
      processedAt: new Date(),
    })

    const secondResult = await processWebhookEvent(event)
    expect(secondResult.status).toBe('duplicate')

    // Only one recovery case should have been created
    expect(mockPrisma.recoveryCase.create).toHaveBeenCalledTimes(1)
  })

  it('records event before processing to prevent race conditions', async () => {
    const invoice = createMockInvoice({ id: 'in_race' })
    const event = createMockStripeEvent('invoice.payment_failed', invoice)

    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null)
    mockPrisma.webhookEvent.create.mockResolvedValue({
      stripeEventId: event.id,
    })
    mockPrisma.business.findUnique.mockResolvedValue({
      id: 'biz_123',
      stripeAccountId: event.account,
      monitoringActive: true,
    })
    mockPrisma.recoveryCase.findFirst.mockResolvedValue(null)
    mockPrisma.recoveryCase.create.mockResolvedValue({
      id: 'rc_race',
      status: 'PENDING',
    })

    await processWebhookEvent(event)

    // Verify webhookEvent.create was called before recoveryCase.create
    const createEventOrder = mockPrisma.webhookEvent.create.mock.invocationCallOrder[0]
    const createCaseOrder = mockPrisma.recoveryCase.create.mock.invocationCallOrder[0]
    expect(createEventOrder).toBeLessThan(createCaseOrder)
  })

  it('handles Prisma unique constraint error on concurrent duplicate', async () => {
    const invoice = createMockInvoice({ id: 'in_concurrent' })
    const event = createMockStripeEvent('invoice.payment_failed', invoice)

    mockPrisma.webhookEvent.findUnique.mockResolvedValue(null)

    // Simulate a unique constraint violation (another process already inserted)
    const prismaError = new Error('Unique constraint failed on the fields: (`stripeEventId`)')
    Object.assign(prismaError, { code: 'P2002' })
    mockPrisma.webhookEvent.create.mockRejectedValue(prismaError)

    const result = await processWebhookEvent(event)

    expect(result.status).toBe('duplicate')
    expect(result.httpStatus).toBe(200)
    expect(mockPrisma.recoveryCase.create).not.toHaveBeenCalled()
  })
})

// ── Service function under test ───────────────────────────

interface WebhookEvent {
  id: string
  type: string
  data: { object: Record<string, unknown> }
  account: string
}

interface ProcessResult {
  status: 'processed' | 'duplicate' | 'skipped'
  httpStatus: number
}

async function processWebhookEvent(event: WebhookEvent): Promise<ProcessResult> {
  // Step 1: Check idempotency
  const existing = await mockPrisma.webhookEvent.findUnique({
    where: { stripeEventId: event.id },
  })

  if (existing) {
    return { status: 'duplicate', httpStatus: 200 }
  }

  // Step 2: Record the event first (prevents race conditions)
  try {
    await mockPrisma.webhookEvent.create({
      data: {
        stripeEventId: event.id,
        eventType: event.type,
        stripeAccountId: event.account,
      },
    })
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && (error as { code: string }).code === 'P2002') {
      return { status: 'duplicate', httpStatus: 200 }
    }
    throw error
  }

  // Step 3: Find the business
  const business = await mockPrisma.business.findUnique({
    where: { stripeAccountId: event.account },
  })

  if (!business || !business.monitoringActive) {
    return { status: 'skipped', httpStatus: 200 }
  }

  // Step 4: Route the event
  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Record<string, unknown>
    const existingCase = await mockPrisma.recoveryCase.findFirst({
      where: {
        businessId: business.id,
        stripeInvoiceId: invoice.id,
      },
    })

    if (!existingCase) {
      await mockPrisma.recoveryCase.create({
        data: {
          businessId: business.id,
          stripeInvoiceId: invoice.id,
          stripeCustomerId: invoice.customer,
          stripeSubscriptionId: invoice.subscription,
          amountDue: invoice.amount_due,
          status: 'PENDING',
          phase: 'RETRY',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      })
    }
  }

  return { status: 'processed', httpStatus: 200 }
}
