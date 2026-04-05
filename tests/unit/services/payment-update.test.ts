/**
 * @jest-environment node
 */

import { generatePaymentUpdateToken, validatePaymentUpdateToken } from '@/services/payment-update'

// ── Mocks ────────────────────────────────────────────────

const mockPrisma = {
  paymentUpdateSession: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}

jest.mock('@/lib/prisma', () => ({
  prisma: {
    paymentUpdateSession: {
      create: (...args: unknown[]) => mockPrisma.paymentUpdateSession.create(...args),
      findUnique: (...args: unknown[]) => mockPrisma.paymentUpdateSession.findUnique(...args),
      update: (...args: unknown[]) => mockPrisma.paymentUpdateSession.update(...args),
    },
  },
}))

const mockSignJWT = {
  setProtectedHeader: jest.fn().mockReturnThis(),
  setIssuedAt: jest.fn().mockReturnThis(),
  setExpirationTime: jest.fn().mockReturnThis(),
  sign: jest.fn().mockResolvedValue('mock-jwt-token'),
}

jest.mock('jose', () => ({
  SignJWT: jest.fn(() => mockSignJWT),
  jwtVerify: jest.fn(),
}))

import { SignJWT, jwtVerify } from 'jose'

// ── Helpers ──────────────────────────────────────────────

const createMockSession = (overrides: Record<string, unknown> = {}) => ({
  id: 'session_001',
  recoveryCaseId: 'rc_001',
  token: 'mock-jwt-token',
  expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
  status: 'ACTIVE',
  setupIntentId: null,
  usedAt: null,
  recoveryCase: {
    id: 'rc_001',
    business: {
      id: 'biz_001',
      brandingSettings: {
        companyName: 'Test Business',
        logoUrl: 'https://example.com/logo.png',
        primaryColor: '#0066ff',
      },
    },
  },
  ...overrides,
})

// ── Tests ────────────────────────────────────────────────

describe('generatePaymentUpdateToken', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPrisma.paymentUpdateSession.create.mockResolvedValue({ id: 'session_001' })
  })

  it('creates a JWT and persists a PaymentUpdateSession record', async () => {
    const token = await generatePaymentUpdateToken('rc_001')

    expect(token).toBe('mock-jwt-token')
    expect(SignJWT).toHaveBeenCalledWith({ recoveryCaseId: 'rc_001' })
    expect(mockSignJWT.setProtectedHeader).toHaveBeenCalledWith({ alg: 'HS256' })
    expect(mockSignJWT.setIssuedAt).toHaveBeenCalled()
    expect(mockSignJWT.setExpirationTime).toHaveBeenCalledWith('48h')
    expect(mockSignJWT.sign).toHaveBeenCalled()

    expect(mockPrisma.paymentUpdateSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recoveryCaseId: 'rc_001',
        token: 'mock-jwt-token',
        status: 'ACTIVE',
        expiresAt: expect.any(Date),
      }),
    })
  })
})

describe('validatePaymentUpdateToken', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns session data for a valid token', async () => {
    ;(jwtVerify as jest.Mock).mockResolvedValue({
      payload: { recoveryCaseId: 'rc_001' },
    })
    mockPrisma.paymentUpdateSession.findUnique.mockResolvedValue(createMockSession())

    const result = await validatePaymentUpdateToken('mock-jwt-token')

    expect(result).not.toBeNull()
    expect(result?.recoveryCaseId).toBe('rc_001')
    expect(result?.session.recoveryCase.business.brandingSettings?.companyName).toBe('Test Business')
  })

  it('returns null for expired tokens', async () => {
    ;(jwtVerify as jest.Mock).mockResolvedValue({
      payload: { recoveryCaseId: 'rc_001' },
    })
    mockPrisma.paymentUpdateSession.findUnique.mockResolvedValue(
      createMockSession({
        expiresAt: new Date(Date.now() - 1000),
      })
    )

    const result = await validatePaymentUpdateToken('expired-token')

    expect(result).toBeNull()
  })

  it('returns null for already-used tokens', async () => {
    ;(jwtVerify as jest.Mock).mockResolvedValue({
      payload: { recoveryCaseId: 'rc_001' },
    })
    mockPrisma.paymentUpdateSession.findUnique.mockResolvedValue(
      createMockSession({
        status: 'USED',
        usedAt: new Date(),
      })
    )

    const result = await validatePaymentUpdateToken('used-token')

    expect(result).toBeNull()
  })

  it('returns null for invalid/malformed tokens', async () => {
    ;(jwtVerify as jest.Mock).mockRejectedValue(new Error('JWTInvalid'))

    const result = await validatePaymentUpdateToken('malformed-garbage')

    expect(result).toBeNull()
  })

  it('returns null when session is not found in database', async () => {
    ;(jwtVerify as jest.Mock).mockResolvedValue({
      payload: { recoveryCaseId: 'rc_001' },
    })
    mockPrisma.paymentUpdateSession.findUnique.mockResolvedValue(null)

    const result = await validatePaymentUpdateToken('orphan-token')

    expect(result).toBeNull()
  })
})
