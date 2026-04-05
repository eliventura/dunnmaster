import { PRICING_TIERS } from '@/constants/pricing-tiers'

// ── Mocks ────────────────────────────────────────────────

const mockPrisma = {
  subscriptionPlan: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}

jest.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

const mockStripe = {
  subscriptions: {
    retrieve: jest.fn(),
    update: jest.fn(),
  },
}

jest.mock('@/lib/stripe', () => ({ stripe: mockStripe }))

jest.mock('@/lib/auth', () => ({
  auth: jest.fn().mockResolvedValue({ user: { id: 'user_001' } }),
}))

jest.mock('@/lib/auth-middleware', () => ({
  getAuthenticatedBusiness: jest.fn().mockResolvedValue({
    business: {
      id: 'biz_001',
      subscriptionPlan: {
        tier: 'STARTER',
        stripeSubscriptionId: 'sub_test_001',
        stripePriceId: 'price_starter',
        currentMrrMonitored: 500_000,
        mrrLimit: 1_000_000,
        currentPeriodStart: new Date('2026-03-01'),
        currentPeriodEnd: new Date('2026-04-01'),
        status: 'ACTIVE',
      },
    },
    userId: 'user_001',
  }),
}))

import { changePlan } from '@/services/billing'

// ── Helpers ──────────────────────────────────────────────

const createMockSubscription = (tier: string) => ({
  id: 'sub_test_001',
  items: {
    data: [{
      id: 'si_test_001',
      price: {
        id: tier === 'STARTER' ? 'price_starter'
          : tier === 'GROWTH' ? 'price_growth'
          : 'price_scale',
      },
    }],
  },
  current_period_start: Math.floor(new Date('2026-04-01').getTime() / 1000),
  current_period_end: Math.floor(new Date('2026-05-01').getTime() / 1000),
})

// ── Tests ────────────────────────────────────────────────

describe('Plan Change Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('upgrades from STARTER to GROWTH with proration', async () => {
    mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
      tier: 'STARTER',
      stripeSubscriptionId: 'sub_test_001',
      business: { id: 'biz_001' },
    })

    const updatedSub = createMockSubscription('GROWTH')
    mockStripe.subscriptions.retrieve.mockResolvedValue(createMockSubscription('STARTER'))
    mockStripe.subscriptions.update.mockResolvedValue(updatedSub)
    mockPrisma.subscriptionPlan.update.mockResolvedValue({ tier: 'GROWTH' })

    const result = await changePlan('biz_001', 'GROWTH')

    expect(result.previousTier).toBe('STARTER')
    expect(result.newTier).toBe('GROWTH')
    expect(result.effectiveAt).toBeDefined()

    // Verify Stripe was called with proration
    expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
      'sub_test_001',
      expect.objectContaining({
        proration_behavior: 'create_prorations',
      })
    )

    // Verify local DB was updated
    expect(mockPrisma.subscriptionPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId: 'biz_001' },
        data: expect.objectContaining({
          tier: 'GROWTH',
        }),
      })
    )
  })

  it('updates Stripe subscription with correct price ID', async () => {
    mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
      tier: 'STARTER',
      stripeSubscriptionId: 'sub_test_001',
      business: { id: 'biz_001' },
    })

    const currentSub = createMockSubscription('STARTER')
    const updatedSub = createMockSubscription('SCALE')
    mockStripe.subscriptions.retrieve.mockResolvedValue(currentSub)
    mockStripe.subscriptions.update.mockResolvedValue(updatedSub)
    mockPrisma.subscriptionPlan.update.mockResolvedValue({ tier: 'SCALE' })

    process.env.STRIPE_SCALE_PRICE_ID = 'price_scale_env'

    await changePlan('biz_001', 'SCALE')

    expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
      'sub_test_001',
      expect.objectContaining({
        items: [{
          id: 'si_test_001',
          price: 'price_scale_env',
        }],
      })
    )
  })

  it('throws error when no active subscription found', async () => {
    mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(null)

    await expect(changePlan('biz_001', 'GROWTH')).rejects.toThrow(
      'No active subscription found'
    )
  })

  it('throws error when subscription has no Stripe ID', async () => {
    mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
      tier: 'STARTER',
      stripeSubscriptionId: null,
      business: { id: 'biz_001' },
    })

    await expect(changePlan('biz_001', 'GROWTH')).rejects.toThrow(
      'No active subscription found'
    )
  })

  it('updates mrrLimit correctly for SCALE (unlimited)', async () => {
    mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
      tier: 'GROWTH',
      stripeSubscriptionId: 'sub_test_001',
      business: { id: 'biz_001' },
    })

    const updatedSub = createMockSubscription('SCALE')
    mockStripe.subscriptions.retrieve.mockResolvedValue(createMockSubscription('GROWTH'))
    mockStripe.subscriptions.update.mockResolvedValue(updatedSub)
    mockPrisma.subscriptionPlan.update.mockResolvedValue({ tier: 'SCALE' })

    await changePlan('biz_001', 'SCALE')

    expect(mockPrisma.subscriptionPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mrrLimit: 999999999,
        }),
      })
    )
  })
})

describe('POST /api/billing/change-plan validation', () => {
  it('validates tier is a valid PlanTier', async () => {
    // Import after mocks are set up
    const { POST } = await import('@/app/api/billing/change-plan/route')

    const request = new Request('http://localhost/api/billing/change-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: 'INVALID_TIER' }),
    })

    const response = await POST(request as any)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error.code).toBe('INVALID_TIER')
  })

  it('returns 400 for same tier', async () => {
    const { POST } = await import('@/app/api/billing/change-plan/route')

    const request = new Request('http://localhost/api/billing/change-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: 'STARTER' }),
    })

    const response = await POST(request as any)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error.code).toBe('SAME_TIER')
  })
})
