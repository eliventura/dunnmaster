import { getDashboardMetrics } from '@/services/dashboard'

// ── Mocks ────────────────────────────────────────────────

const mockPrisma = {
  recoveryCase: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
}

jest.mock('@/lib/prisma', () => ({
  prisma: {
    recoveryCase: {
      findMany: (...args: unknown[]) => mockPrisma.recoveryCase.findMany(...args),
      count: (...args: unknown[]) => mockPrisma.recoveryCase.count(...args),
    },
  },
}))

// ── Helpers ──────────────────────────────────────────────

const BUSINESS_ID = 'biz_test_001'

beforeEach(() => {
  jest.clearAllMocks()
})

describe('getDashboardMetrics', () => {
  it('correctly sums amountDue for active cases as mrrAtRisk', async () => {
    const activeCases = [
      { amountDue: 2999, currency: 'usd' },
      { amountDue: 4999, currency: 'usd' },
      { amountDue: 1500, currency: 'usd' },
    ]

    mockPrisma.recoveryCase.findMany
      .mockResolvedValueOnce(activeCases) // active cases query
      .mockResolvedValueOnce([           // recovered cases amount query
        { amountDue: 1000 },
      ])
    mockPrisma.recoveryCase.count
      .mockResolvedValueOnce(1) // recoveredThisMonth
      .mockResolvedValueOnce(0) // failedThisMonth

    const metrics = await getDashboardMetrics(BUSINESS_ID)

    expect(metrics.mrrAtRisk).toBe(2999 + 4999 + 1500)
  })

  it('correctly sums amountDue for RECOVERED cases this month as mrrRecovered', async () => {
    const recoveredCases = [
      { amountDue: 5000 },
      { amountDue: 3000 },
    ]

    mockPrisma.recoveryCase.findMany
      .mockResolvedValueOnce([]) // active cases
      .mockResolvedValueOnce(recoveredCases) // recovered cases amount
    mockPrisma.recoveryCase.count
      .mockResolvedValueOnce(2) // recoveredThisMonth
      .mockResolvedValueOnce(1) // failedThisMonth

    const metrics = await getDashboardMetrics(BUSINESS_ID)

    expect(metrics.mrrRecovered).toBe(8000)
  })

  it('calculates recoveryRate as recovered / (recovered + failed)', async () => {
    mockPrisma.recoveryCase.findMany
      .mockResolvedValueOnce([]) // active cases
      .mockResolvedValueOnce([]) // recovered cases amount
    mockPrisma.recoveryCase.count
      .mockResolvedValueOnce(3) // recoveredThisMonth
      .mockResolvedValueOnce(1) // failedThisMonth

    const metrics = await getDashboardMetrics(BUSINESS_ID)

    expect(metrics.recoveryRate).toBe(3 / 4)
    expect(metrics.recoveryRate).toBeCloseTo(0.75)
  })

  it('handles zero cases gracefully with no division by zero', async () => {
    mockPrisma.recoveryCase.findMany
      .mockResolvedValueOnce([]) // active cases
      .mockResolvedValueOnce([]) // recovered cases amount
    mockPrisma.recoveryCase.count
      .mockResolvedValueOnce(0) // recoveredThisMonth
      .mockResolvedValueOnce(0) // failedThisMonth

    const metrics = await getDashboardMetrics(BUSINESS_ID)

    expect(metrics.recoveryRate).toBe(0)
    expect(metrics.mrrAtRisk).toBe(0)
    expect(metrics.mrrRecovered).toBe(0)
    expect(metrics.activeCases).toBe(0)
    expect(metrics.recoveredThisMonth).toBe(0)
    expect(metrics.failedThisMonth).toBe(0)
    expect(metrics.currency).toBe('usd')
  })

  it('counts active cases correctly', async () => {
    const activeCases = [
      { amountDue: 1000, currency: 'usd' },
      { amountDue: 2000, currency: 'usd' },
      { amountDue: 3000, currency: 'usd' },
      { amountDue: 4000, currency: 'usd' },
      { amountDue: 5000, currency: 'usd' },
    ]

    mockPrisma.recoveryCase.findMany
      .mockResolvedValueOnce(activeCases)
      .mockResolvedValueOnce([])
    mockPrisma.recoveryCase.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)

    const metrics = await getDashboardMetrics(BUSINESS_ID)

    expect(metrics.activeCases).toBe(5)
  })
})
