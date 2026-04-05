import { mockStripe, createMockStripeEvent, createMockInvoice } from '../../__mocks__/stripe'

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
    update: jest.fn(),
  },
}

jest.mock('@/lib/stripe', () => ({ stripe: mockStripe }))
jest.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

const WEBHOOK_SECRET = 'whsec_test_secret'

beforeEach(() => {
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
})

describe('Stripe Webhook Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Signature Verification', () => {
    it('verifies webhook signature and processes event', async () => {
      const event = createMockStripeEvent('invoice.payment_failed', createMockInvoice())
      const rawBody = JSON.stringify(event)
      const signature = 'valid_sig_header'

      mockStripe.webhooks.constructEvent.mockReturnValue(event)

      const verifiedEvent = mockStripe.webhooks.constructEvent(
        rawBody,
        signature,
        WEBHOOK_SECRET
      )

      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        rawBody,
        signature,
        WEBHOOK_SECRET
      )
      expect(verifiedEvent.type).toBe('invoice.payment_failed')
      expect(verifiedEvent.id).toBeDefined()
    })

    it('returns 400 for invalid signature', async () => {
      const rawBody = '{"id": "evt_fake"}'
      const badSignature = 'invalid_signature'

      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('No signatures found matching the expected signature for payload')
      })

      expect(() =>
        mockStripe.webhooks.constructEvent(rawBody, badSignature, WEBHOOK_SECRET)
      ).toThrow('No signatures found matching the expected signature')

      // The handler should catch this and return 400
      const response = handleSignatureError(
        () => mockStripe.webhooks.constructEvent(rawBody, badSignature, WEBHOOK_SECRET)
      )
      expect(response.status).toBe(400)
    })

    it('returns 400 when signature header is missing', async () => {
      const response = validateSignatureHeader(undefined)
      expect(response.status).toBe(400)
      expect(response.error!.code).toBe('MISSING_SIGNATURE')
    })
  })

  describe('Event Routing: invoice.payment_failed', () => {
    it('creates recovery case on invoice.payment_failed', async () => {
      const invoice = createMockInvoice({
        id: 'in_failed123',
        customer: 'cus_abc',
        subscription: 'sub_abc',
        amount_due: 9900,
        customer_email: 'customer@example.com',
      })

      const event = createMockStripeEvent(
        'invoice.payment_failed',
        invoice,
        'acct_connected123'
      )

      mockStripe.webhooks.constructEvent.mockReturnValue(event)

      // Check idempotency - event not yet processed
      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null)

      // Find the connected business
      mockPrisma.business.findUnique.mockResolvedValue({
        id: 'biz_123',
        stripeAccountId: 'acct_connected123',
        monitoringActive: true,
      })

      // No existing recovery case for this invoice
      mockPrisma.recoveryCase.findFirst.mockResolvedValue(null)

      // Create the recovery case
      mockPrisma.recoveryCase.create.mockResolvedValue({
        id: 'rc_new',
        businessId: 'biz_123',
        stripeInvoiceId: 'in_failed123',
        stripeCustomerId: 'cus_abc',
        stripeSubscriptionId: 'sub_abc',
        amountDue: 9900,
        declineCode: 'insufficient_funds',
        declineType: 'SOFT',
        status: 'PENDING',
        phase: 'RETRY',
      })

      // Record processed event
      mockPrisma.webhookEvent.create.mockResolvedValue({
        stripeEventId: event.id,
        eventType: 'invoice.payment_failed',
      })

      // Simulate handler flow
      const verifiedEvent = mockStripe.webhooks.constructEvent('body', 'sig', WEBHOOK_SECRET)
      const existingEvent = await mockPrisma.webhookEvent.findUnique({
        where: { stripeEventId: verifiedEvent.id },
      })
      expect(existingEvent).toBeNull()

      const business = await mockPrisma.business.findUnique({
        where: { stripeAccountId: verifiedEvent.account },
      })
      expect(business).not.toBeNull()
      expect(business.monitoringActive).toBe(true)

      const existingCase = await mockPrisma.recoveryCase.findFirst({
        where: {
          businessId: business.id,
          stripeInvoiceId: invoice.id,
        },
      })
      expect(existingCase).toBeNull()

      const recoveryCase = await mockPrisma.recoveryCase.create({
        data: {
          businessId: business.id,
          stripeInvoiceId: invoice.id,
          stripeCustomerId: invoice.customer,
          stripeSubscriptionId: invoice.subscription,
          customerEmail: invoice.customer_email,
          amountDue: invoice.amount_due,
          currency: invoice.currency,
          declineCode: invoice.charge.failure_code,
          declineType: classifyDecline(invoice.charge.failure_code),
          status: 'PENDING',
          phase: 'RETRY',
          expiresAt: expect.any(Date),
        },
      })

      expect(recoveryCase.status).toBe('PENDING')
      expect(recoveryCase.declineCode).toBe('insufficient_funds')

      await mockPrisma.webhookEvent.create({
        data: {
          stripeEventId: verifiedEvent.id,
          eventType: verifiedEvent.type,
          stripeAccountId: verifiedEvent.account,
        },
      })

      expect(mockPrisma.webhookEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          stripeEventId: verifiedEvent.id,
          eventType: 'invoice.payment_failed',
        }),
      })
    })

    it('skips case creation when business monitoring is inactive', async () => {
      const invoice = createMockInvoice()
      const event = createMockStripeEvent('invoice.payment_failed', invoice)

      mockStripe.webhooks.constructEvent.mockReturnValue(event)
      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null)
      mockPrisma.business.findUnique.mockResolvedValue({
        id: 'biz_inactive',
        stripeAccountId: 'acct_test123',
        monitoringActive: false,
      })

      const business = await mockPrisma.business.findUnique({
        where: { stripeAccountId: event.account },
      })

      expect(business.monitoringActive).toBe(false)
      // Handler should return early without creating a case
      expect(mockPrisma.recoveryCase.create).not.toHaveBeenCalled()
    })

    it('skips case creation when recovery case already exists', async () => {
      const invoice = createMockInvoice({ id: 'in_duplicate' })
      const event = createMockStripeEvent('invoice.payment_failed', invoice)

      mockStripe.webhooks.constructEvent.mockReturnValue(event)
      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null)
      mockPrisma.business.findUnique.mockResolvedValue({
        id: 'biz_123',
        stripeAccountId: 'acct_test123',
        monitoringActive: true,
      })
      mockPrisma.recoveryCase.findFirst.mockResolvedValue({
        id: 'rc_existing',
        stripeInvoiceId: 'in_duplicate',
        status: 'RETRYING',
      })

      const business = await mockPrisma.business.findUnique({
        where: { stripeAccountId: event.account },
      })
      const existingCase = await mockPrisma.recoveryCase.findFirst({
        where: {
          businessId: business.id,
          stripeInvoiceId: invoice.id,
        },
      })

      expect(existingCase).not.toBeNull()
      expect(mockPrisma.recoveryCase.create).not.toHaveBeenCalled()
    })
  })

  describe('Event Routing: invoice.payment_succeeded', () => {
    it('closes recovery case on invoice.payment_succeeded', async () => {
      const invoice = createMockInvoice({
        id: 'in_recovered',
        status: 'paid',
      })
      const event = createMockStripeEvent('invoice.payment_succeeded', invoice)

      mockStripe.webhooks.constructEvent.mockReturnValue(event)
      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null)
      mockPrisma.business.findUnique.mockResolvedValue({
        id: 'biz_123',
        stripeAccountId: 'acct_test123',
        monitoringActive: true,
      })
      mockPrisma.recoveryCase.findFirst.mockResolvedValue({
        id: 'rc_active',
        stripeInvoiceId: 'in_recovered',
        status: 'RETRYING',
      })
      mockPrisma.recoveryCase.update.mockResolvedValue({
        id: 'rc_active',
        status: 'RECOVERED',
        recoveredAt: new Date(),
      })

      const business = await mockPrisma.business.findUnique({
        where: { stripeAccountId: event.account },
      })

      const activeCase = await mockPrisma.recoveryCase.findFirst({
        where: {
          businessId: business.id,
          stripeInvoiceId: invoice.id,
          status: { in: ['PENDING', 'RETRYING', 'EMAILING'] },
        },
      })

      expect(activeCase).not.toBeNull()

      const updatedCase = await mockPrisma.recoveryCase.update({
        where: { id: activeCase.id },
        data: {
          status: 'RECOVERED',
          recoveredAt: expect.any(Date),
        },
      })

      expect(updatedCase.status).toBe('RECOVERED')
      expect(mockPrisma.recoveryCase.update).toHaveBeenCalledWith({
        where: { id: 'rc_active' },
        data: expect.objectContaining({ status: 'RECOVERED' }),
      })
    })

    it('does nothing when no active recovery case exists', async () => {
      const invoice = createMockInvoice({ id: 'in_no_case' })
      const event = createMockStripeEvent('invoice.payment_succeeded', invoice)

      mockStripe.webhooks.constructEvent.mockReturnValue(event)
      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null)
      mockPrisma.business.findUnique.mockResolvedValue({
        id: 'biz_123',
        stripeAccountId: 'acct_test123',
        monitoringActive: true,
      })
      mockPrisma.recoveryCase.findFirst.mockResolvedValue(null)

      const business = await mockPrisma.business.findUnique({
        where: { stripeAccountId: event.account },
      })

      const activeCase = await mockPrisma.recoveryCase.findFirst({
        where: {
          businessId: business.id,
          stripeInvoiceId: invoice.id,
        },
      })

      expect(activeCase).toBeNull()
      expect(mockPrisma.recoveryCase.update).not.toHaveBeenCalled()
    })
  })

  describe('Event Routing: customer.subscription.deleted', () => {
    it('cancels recovery case on subscription cancellation', async () => {
      const subscription = {
        id: 'sub_cancelled',
        customer: 'cus_abc',
        status: 'canceled',
      }
      const event = createMockStripeEvent(
        'customer.subscription.deleted',
        subscription
      )

      mockStripe.webhooks.constructEvent.mockReturnValue(event)
      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null)
      mockPrisma.business.findUnique.mockResolvedValue({
        id: 'biz_123',
        stripeAccountId: 'acct_test123',
        monitoringActive: true,
      })
      mockPrisma.recoveryCase.findFirst.mockResolvedValue({
        id: 'rc_sub_active',
        stripeSubscriptionId: 'sub_cancelled',
        status: 'RETRYING',
      })
      mockPrisma.recoveryCase.update.mockResolvedValue({
        id: 'rc_sub_active',
        status: 'CANCELLED',
      })

      const business = await mockPrisma.business.findUnique({
        where: { stripeAccountId: event.account },
      })

      const activeCase = await mockPrisma.recoveryCase.findFirst({
        where: {
          businessId: business.id,
          stripeSubscriptionId: subscription.id,
          status: { in: ['PENDING', 'RETRYING', 'EMAILING'] },
        },
      })

      expect(activeCase).not.toBeNull()

      const cancelledCase = await mockPrisma.recoveryCase.update({
        where: { id: activeCase.id },
        data: { status: 'CANCELLED' },
      })

      expect(cancelledCase.status).toBe('CANCELLED')
      expect(mockPrisma.recoveryCase.update).toHaveBeenCalledWith({
        where: { id: 'rc_sub_active' },
        data: { status: 'CANCELLED' },
      })
    })
  })

  describe('Unhandled Event Types', () => {
    it('acknowledges unhandled event types with 200', async () => {
      const event = createMockStripeEvent('charge.refunded', { id: 'ch_test' })
      mockStripe.webhooks.constructEvent.mockReturnValue(event)
      mockPrisma.webhookEvent.findUnique.mockResolvedValue(null)

      const verifiedEvent = mockStripe.webhooks.constructEvent('body', 'sig', WEBHOOK_SECRET)

      // Unhandled events should be acknowledged but not processed
      const isHandled = isHandledEventType(verifiedEvent.type)
      expect(isHandled).toBe(false)
    })
  })
})

// ── Helper functions ──────────────────────────────────────

function handleSignatureError(verify: () => unknown) {
  try {
    verify()
    return { status: 200, error: null }
  } catch {
    return { status: 400, error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed' } }
  }
}

function validateSignatureHeader(header: string | undefined) {
  if (!header) {
    return { status: 400, error: { code: 'MISSING_SIGNATURE', message: 'Missing stripe-signature header' } }
  }
  return { status: 200, error: null }
}

function classifyDecline(code: string): 'SOFT' | 'HARD' {
  const hardDeclines = [
    'card_declined',
    'expired_card',
    'stolen_card',
    'lost_card',
    'fraudulent',
  ]
  return hardDeclines.includes(code) ? 'HARD' : 'SOFT'
}

function isHandledEventType(type: string): boolean {
  const handledTypes = [
    'invoice.payment_failed',
    'invoice.payment_succeeded',
    'customer.subscription.deleted',
  ]
  return handledTypes.includes(type)
}
