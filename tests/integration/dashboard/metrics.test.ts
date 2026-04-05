/**
 * @jest-environment node
 */

import { GET } from '@/app/api/dashboard/metrics/route'

// ── Mocks ────────────────────────────────────────────────

const mockPrisma = {
  business: {
    findUnique: jest.fn(),
  },
  recoveryCase: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
}

jest.mock('@/lib/prisma', () => ({
  prisma: {
    business: {
      findUnique: (...args: unknown[]) => mockPrisma.business.findUnique(...args),
    },
    recoveryCase: {
      findMany: (...args: unknown[]) => mockPrisma.recoveryCase.findMany(...args),
      count: (...args: unknown[]) => mockPrisma.recoveryCase.count(...args),
    },
  },
}))

const mockAuth = jest.fn()

jest.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

// ── Helpers ──────────────────────────────────────────────

const MOCK_BUSINESS = {
  id: 'biz_test_001',
  userId: 'user_001',
  brandingSettings: null,
  subscriptionPlan: null,
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('GET /api/dashboard/metrics', () => {
  it('returns correct metrics shape', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user_001' } })
    mockPrisma.business.findUnique.mockResolvedValue(MOCK_BUSINESS)

    mockPrisma.recoveryCase.findMany
      .mockResolvedValueOnce([
        { amountDue: 2999, currency: 'usd' },
        { amountDue: 4999, currency: 'usd' },
      ])
      .mockResolvedValueOnce([
        { amountDue: 1500 },
      ])

    mockPrisma.recoveryCase.count
      .mockResolvedValueOnce(1) // recoveredThisMonth
      .mockResolvedValueOnce(2) // failedThisMonth

    const response = await GET()
    const body = await response!.json()

    expect(response!.status).toBe(200)
    expect(body.data).toEqual({
      mrrAtRisk: 7998,
      mrrRecovered: 1500,
      recoveryRate: 1 / 3,
      activeCases: 2,
      recoveredThisMonth: 1,
      failedThisMonth: 2,
      currency: 'usd',
    })
    expect(body.meta).toHaveProperty('timestamp')
  })

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)

    const response = await GET()
    const body = await response!.json()

    expect(response!.status).toBe(401)
    expect(body.error.code).toBe('UNAUTHORIZED')
  })
})
