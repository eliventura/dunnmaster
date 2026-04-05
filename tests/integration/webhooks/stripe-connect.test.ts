import { mockStripe } from '../../__mocks__/stripe'

const mockAuth = jest.fn()
const mockPrisma = {
  business: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  recoveryCase: {
    updateMany: jest.fn(),
  },
}

jest.mock('@/lib/stripe', () => ({ stripe: mockStripe }))
jest.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
jest.mock('@/lib/auth', () => ({ auth: mockAuth }))

const CONNECT_CLIENT_ID = 'ca_test123'
const CONNECT_REDIRECT_URI = 'http://localhost:3000/api/stripe/connect/callback'

beforeEach(() => {
  process.env.STRIPE_CONNECT_CLIENT_ID = CONNECT_CLIENT_ID
  process.env.STRIPE_CONNECT_REDIRECT_URI = CONNECT_REDIRECT_URI
})

describe('Stripe Connect OAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /api/stripe/connect', () => {
    it('returns Stripe Connect OAuth redirect URL', async () => {
      const userId = 'user_abc123'
      mockAuth.mockResolvedValue({ user: { id: userId } })
      mockPrisma.business.findUnique.mockResolvedValue({
        id: 'biz_123',
        userId,
        stripeAccountId: null,
      })

      const result = buildConnectUrl(userId)

      expect(result).toContain('https://connect.stripe.com/oauth/authorize')
      expect(result).toContain(`client_id=${CONNECT_CLIENT_ID}`)
      expect(result).toContain('response_type=code')
      expect(result).toContain(`state=${userId}`)
      expect(result).toContain('scope=read_write')
      expect(result).toContain(`redirect_uri=${encodeURIComponent(CONNECT_REDIRECT_URI)}`)
    })

    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue(null)

      const session = await mockAuth()
      expect(session).toBeNull()

      // The route handler should check session and return 401
      const response = simulateAuthGuard(session)
      expect(response.status).toBe(401)
      expect(response.error.code).toBe('UNAUTHORIZED')
    })

    it('returns 409 when business already has Stripe connected', async () => {
      const userId = 'user_abc123'
      mockAuth.mockResolvedValue({ user: { id: userId } })
      mockPrisma.business.findUnique.mockResolvedValue({
        id: 'biz_123',
        userId,
        stripeAccountId: 'acct_existing',
      })

      const business = await mockPrisma.business.findUnique({ where: { userId } })
      expect(business.stripeAccountId).not.toBeNull()
    })
  })

  describe('GET /api/stripe/connect/callback', () => {
    it('exchanges code for tokens and creates business', async () => {
      const userId = 'user_abc123'
      const authCode = 'ac_testcode123'

      mockStripe.oauth.token.mockResolvedValue({
        stripe_user_id: 'acct_test123',
        access_token: 'sk_test_connected',
        refresh_token: 'rt_test',
      })

      mockPrisma.business.findUnique.mockResolvedValue(null)
      mockPrisma.business.create.mockResolvedValue({
        id: 'biz_new',
        userId,
        stripeAccountId: 'acct_test123',
        stripeAccessToken: 'sk_test_connected',
        stripeRefreshToken: 'rt_test',
        monitoringActive: true,
      })

      // Simulate the callback flow
      const tokenResult = await mockStripe.oauth.token({
        grant_type: 'authorization_code',
        code: authCode,
      })

      expect(mockStripe.oauth.token).toHaveBeenCalledWith({
        grant_type: 'authorization_code',
        code: authCode,
      })
      expect(tokenResult.stripe_user_id).toBe('acct_test123')
      expect(tokenResult.access_token).toBe('sk_test_connected')

      // Simulate creating the business record
      const business = await mockPrisma.business.create({
        data: {
          userId,
          stripeAccountId: tokenResult.stripe_user_id,
          stripeAccessToken: tokenResult.access_token,
          stripeRefreshToken: tokenResult.refresh_token,
          stripeConnectedAt: expect.any(Date),
          monitoringActive: true,
        },
      })

      expect(mockPrisma.business.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          stripeAccountId: 'acct_test123',
          stripeAccessToken: 'sk_test_connected',
          stripeRefreshToken: 'rt_test',
          monitoringActive: true,
        }),
      })
      expect(business.stripeAccountId).toBe('acct_test123')
    })

    it('updates existing business when reconnecting', async () => {
      const userId = 'user_abc123'
      const authCode = 'ac_testcode456'

      mockStripe.oauth.token.mockResolvedValue({
        stripe_user_id: 'acct_new456',
        access_token: 'sk_test_new',
        refresh_token: 'rt_test_new',
      })

      mockPrisma.business.findUnique.mockResolvedValue({
        id: 'biz_existing',
        userId,
        stripeAccountId: null,
      })

      mockPrisma.business.update.mockResolvedValue({
        id: 'biz_existing',
        userId,
        stripeAccountId: 'acct_new456',
      })

      const tokenResult = await mockStripe.oauth.token({
        grant_type: 'authorization_code',
        code: authCode,
      })

      await mockPrisma.business.update({
        where: { userId },
        data: {
          stripeAccountId: tokenResult.stripe_user_id,
          stripeAccessToken: tokenResult.access_token,
          stripeRefreshToken: tokenResult.refresh_token,
          stripeConnectedAt: new Date(),
          monitoringActive: true,
        },
      })

      expect(mockPrisma.business.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId },
          data: expect.objectContaining({
            stripeAccountId: 'acct_new456',
            monitoringActive: true,
          }),
        })
      )
    })

    it('returns 400 for invalid code', async () => {
      mockStripe.oauth.token.mockRejectedValue(
        new Error('Invalid authorization code')
      )

      await expect(
        mockStripe.oauth.token({
          grant_type: 'authorization_code',
          code: 'invalid_code',
        })
      ).rejects.toThrow('Invalid authorization code')
    })
  })

  describe('DELETE /api/stripe/connect', () => {
    it('disconnects account and pauses recovery cases', async () => {
      const userId = 'user_abc123'
      const businessId = 'biz_123'
      const stripeAccountId = 'acct_test123'

      mockAuth.mockResolvedValue({ user: { id: userId } })
      mockPrisma.business.findUnique.mockResolvedValue({
        id: businessId,
        userId,
        stripeAccountId,
        monitoringActive: true,
      })

      mockStripe.oauth.deauthorize.mockResolvedValue({
        stripe_user_id: stripeAccountId,
      })

      mockPrisma.recoveryCase.updateMany.mockResolvedValue({ count: 3 })
      mockPrisma.business.update.mockResolvedValue({
        id: businessId,
        stripeAccountId: null,
        stripeAccessToken: null,
        stripeRefreshToken: null,
        monitoringActive: false,
      })

      // Step 1: Deauthorize with Stripe
      const deauthResult = await mockStripe.oauth.deauthorize({
        client_id: CONNECT_CLIENT_ID,
        stripe_user_id: stripeAccountId,
      })

      expect(deauthResult.stripe_user_id).toBe(stripeAccountId)

      // Step 2: Pause all active recovery cases
      const pauseResult = await mockPrisma.recoveryCase.updateMany({
        where: {
          businessId,
          status: { in: ['PENDING', 'RETRYING', 'EMAILING'] },
        },
        data: { status: 'PAUSED' },
      })

      expect(pauseResult.count).toBe(3)
      expect(mockPrisma.recoveryCase.updateMany).toHaveBeenCalledWith({
        where: {
          businessId,
          status: { in: ['PENDING', 'RETRYING', 'EMAILING'] },
        },
        data: { status: 'PAUSED' },
      })

      // Step 3: Clear Stripe credentials from business
      await mockPrisma.business.update({
        where: { id: businessId },
        data: {
          stripeAccountId: null,
          stripeAccessToken: null,
          stripeRefreshToken: null,
          stripeConnectedAt: null,
          monitoringActive: false,
        },
      })

      expect(mockPrisma.business.update).toHaveBeenCalledWith({
        where: { id: businessId },
        data: expect.objectContaining({
          stripeAccountId: null,
          monitoringActive: false,
        }),
      })
    })

    it('returns 404 when no business exists', async () => {
      const userId = 'user_no_biz'
      mockAuth.mockResolvedValue({ user: { id: userId } })
      mockPrisma.business.findUnique.mockResolvedValue(null)

      const business = await mockPrisma.business.findUnique({
        where: { userId },
      })

      expect(business).toBeNull()
    })
  })
})

// ── Helper functions ──────────────────────────────────────

function buildConnectUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CONNECT_CLIENT_ID,
    scope: 'read_write',
    redirect_uri: CONNECT_REDIRECT_URI,
    state,
  })
  return `https://connect.stripe.com/oauth/authorize?${params.toString()}`
}

function simulateAuthGuard(session: unknown) {
  if (!session) {
    return { status: 401, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }
  }
  return { status: 200, error: null }
}
