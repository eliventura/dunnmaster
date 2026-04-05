import { PRICING_TIERS } from '@/constants/pricing-tiers'

// ── Mocks ────────────────────────────────────────────────

const mockPrisma = {
  subscriptionPlan: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}

jest.mock('@/lib/prisma', () => ({
  prisma: {
    subscriptionPlan: {
      findUnique: (...args: unknown[]) => mockPrisma.subscriptionPlan.findUnique(...args),
      update: (...args: unknown[]) => mockPrisma.subscriptionPlan.update(...args),
    },
  },
}))
jest.mock('@/lib/stripe', () => ({ stripe: {} }))

import { checkTierLimit, getUsagePercentage } from '@/services/billing'

// ── Tests ────────────────────────────────────────────────

describe('checkTierLimit', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns allowed when under limit', async () => {
    mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
      tier: 'STARTER',
      currentMrrMonitored: 500_000, // $5K
    })

    const result = await checkTierLimit('biz_001', 100_000) // adding $1K

    expect(result).toEqual({ allowed: true })
  })

  it('returns not allowed with usage info when over limit', async () => {
    mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
      tier: 'STARTER',
      currentMrrMonitored: 900_000, // $9K
    })

    const result = await checkTierLimit('biz_001', 200_000) // adding $2K, total $11K > $10K

    expect(result).toEqual({
      allowed: false,
      currentUsage: 900_000,
      limit: PRICING_TIERS.STARTER.mrrLimit,
      tier: 'STARTER',
      usagePercent: 900_000 / PRICING_TIERS.STARTER.mrrLimit,
    })
  })

  it('SCALE tier always returns allowed (unlimited)', async () => {
    mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
      tier: 'SCALE',
      currentMrrMonitored: 50_000_000, // $500K
    })

    const result = await checkTierLimit('biz_001', 10_000_000)

    expect(result).toEqual({ allowed: true })
  })

  it('returns not allowed when no plan found', async () => {
    mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(null)

    const result = await checkTierLimit('biz_nonexistent', 100_000)

    expect(result).toEqual({
      allowed: false,
      reason: 'No subscription plan found',
    })
  })
})

describe('getUsagePercentage', () => {
  it('calculates percentage correctly', () => {
    expect(getUsagePercentage(500_000, 1_000_000)).toBe(0.5)
  })

  it('returns 0 for unlimited tier', () => {
    expect(getUsagePercentage(500_000, -1)).toBe(0)
  })

  it('returns value over 1 when exceeding limit', () => {
    expect(getUsagePercentage(1_200_000, 1_000_000)).toBe(1.2)
  })

  it('returns 0 when no usage', () => {
    expect(getUsagePercentage(0, 1_000_000)).toBe(0)
  })
})
