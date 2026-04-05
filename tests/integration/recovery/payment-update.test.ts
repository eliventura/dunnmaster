import { GET } from '@/app/api/payment-update/[token]/route'
import { POST } from '@/app/api/payment-update/[token]/confirm/route'

// ── Mocks ────────────────────────────────────────────────

const mockPrisma = {
  paymentUpdateSession: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}

jest.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

const mockStripe = {
  setupIntents: {
    create: jest.fn(),
    retrieve: jest.fn(),
  },
  customers: {
    update: jest.fn(),
  },
  invoices: {
    pay: jest.fn(),
  },
}

jest.mock('@/lib/stripe', () => ({ stripe: mockStripe }))

jest.mock('jose', () => ({
  SignJWT: jest.fn(),
  jwtVerify: jest.fn(),
}))

import { jwtVerify } from 'jose'

// ── Helpers ──────────────────────────────────────────────

const createMockSession = (overrides: Record<string, unknown> = {}) => ({
  id: 'session_001',
  recoveryCaseId: 'rc_001',
  token: 'valid-token',
  expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
  status: 'ACTIVE',
  setupIntentId: 'seti_001',
  usedAt: null,
  recoveryCase: {
    id: 'rc_001',
    stripeInvoiceId: 'in_001',
    stripeCustomerId: 'cus_001',
    amountDue: 4999,
    currency: 'usd',
    business: {
      id: 'biz_001',
      name: 'Acme Corp',
      stripeAccountId: 'acct_001',
      brandingSettings: {
        logoUrl: 'https://example.com/logo.png',
        primaryColor: '#0066ff',
      },
    },
  },
  ...overrides,
})

const createRequest = (url: string, options?: RequestInit) =>
  new Request(url, options)

const createParams = (token: string) =>
  Promise.resolve({ token })

// ── GET /api/payment-update/[token] ─────────────────────

describe('GET /api/payment-update/[token]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('validates token and returns SetupIntent client_secret with branding', async () => {
    ;(jwtVerify as jest.Mock).mockResolvedValue({
      payload: { recoveryCaseId: 'rc_001' },
    })
    mockPrisma.paymentUpdateSession.findUnique.mockResolvedValue(createMockSession())
    mockStripe.setupIntents.create.mockResolvedValue({
      id: 'seti_new_001',
      client_secret: 'seti_new_001_secret_abc',
    })
    mockPrisma.paymentUpdateSession.update.mockResolvedValue({})

    const req = createRequest('http://localhost/api/payment-update/valid-token')
    const res = await GET(req, { params: createParams('valid-token') })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.clientSecret).toBe('seti_new_001_secret_abc')
    expect(body.data.businessName).toBe('Acme Corp')
    expect(body.data.logoUrl).toBe('https://example.com/logo.png')
    expect(body.data.primaryColor).toBe('#0066ff')
    expect(body.data.amountDue).toBe(4999)
    expect(body.data.currency).toBe('usd')
  })

  it('returns 410 for expired tokens', async () => {
    ;(jwtVerify as jest.Mock).mockResolvedValue({
      payload: { recoveryCaseId: 'rc_001' },
    })
    mockPrisma.paymentUpdateSession.findUnique.mockResolvedValue(
      createMockSession({
        expiresAt: new Date(Date.now() - 1000),
      })
    )

    const req = createRequest('http://localhost/api/payment-update/expired-token')
    const res = await GET(req, { params: createParams('expired-token') })
    const body = await res.json()

    expect(res.status).toBe(410)
    expect(body.error.code).toBe('TOKEN_EXPIRED')
  })

  it('returns 410 for used tokens', async () => {
    ;(jwtVerify as jest.Mock).mockResolvedValue({
      payload: { recoveryCaseId: 'rc_001' },
    })
    mockPrisma.paymentUpdateSession.findUnique.mockResolvedValue(
      createMockSession({
        status: 'USED',
        usedAt: new Date(),
      })
    )

    const req = createRequest('http://localhost/api/payment-update/used-token')
    const res = await GET(req, { params: createParams('used-token') })
    const body = await res.json()

    expect(res.status).toBe(410)
    expect(body.error.code).toBe('TOKEN_EXPIRED')
  })
})

// ── POST /api/payment-update/[token]/confirm ────────────

describe('POST /api/payment-update/[token]/confirm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('updates payment method and triggers retry', async () => {
    ;(jwtVerify as jest.Mock).mockResolvedValue({
      payload: { recoveryCaseId: 'rc_001' },
    })
    mockPrisma.paymentUpdateSession.findUnique.mockResolvedValue(createMockSession())
    mockStripe.setupIntents.retrieve.mockResolvedValue({
      id: 'seti_001',
      payment_method: 'pm_new_001',
    })
    mockStripe.customers.update.mockResolvedValue({})
    mockStripe.invoices.pay.mockResolvedValue({ id: 'in_001', status: 'paid' })
    mockPrisma.paymentUpdateSession.update.mockResolvedValue({})

    const req = createRequest('http://localhost/api/payment-update/valid-token/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setupIntentId: 'seti_001' }),
    })
    const res = await POST(req, { params: createParams('valid-token') })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.success).toBe(true)

    expect(mockStripe.customers.update).toHaveBeenCalledWith(
      'cus_001',
      { invoice_settings: { default_payment_method: 'pm_new_001' } },
      { stripeAccount: 'acct_001' }
    )
    expect(mockStripe.invoices.pay).toHaveBeenCalledWith(
      'in_001',
      { stripeAccount: 'acct_001' }
    )
    expect(mockPrisma.paymentUpdateSession.update).toHaveBeenCalledWith({
      where: { token: 'valid-token' },
      data: { status: 'USED', usedAt: expect.any(Date) },
    })
  })

  it('returns 410 for expired tokens', async () => {
    ;(jwtVerify as jest.Mock).mockResolvedValue({
      payload: { recoveryCaseId: 'rc_001' },
    })
    mockPrisma.paymentUpdateSession.findUnique.mockResolvedValue(
      createMockSession({
        expiresAt: new Date(Date.now() - 1000),
      })
    )

    const req = createRequest('http://localhost/api/payment-update/expired-token/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setupIntentId: 'seti_001' }),
    })
    const res = await POST(req, { params: createParams('expired-token') })
    const body = await res.json()

    expect(res.status).toBe(410)
    expect(body.error.code).toBe('TOKEN_EXPIRED')
  })

  it('returns 410 for used tokens', async () => {
    ;(jwtVerify as jest.Mock).mockResolvedValue({
      payload: { recoveryCaseId: 'rc_001' },
    })
    mockPrisma.paymentUpdateSession.findUnique.mockResolvedValue(
      createMockSession({
        status: 'USED',
        usedAt: new Date(),
      })
    )

    const req = createRequest('http://localhost/api/payment-update/used-token/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setupIntentId: 'seti_001' }),
    })
    const res = await POST(req, { params: createParams('used-token') })
    const body = await res.json()

    expect(res.status).toBe(410)
    expect(body.error.code).toBe('TOKEN_EXPIRED')
  })
})
