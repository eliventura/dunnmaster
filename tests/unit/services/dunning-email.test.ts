import { scheduleDunningEmails } from '@/services/dunning-email'

const mockFindUnique = jest.fn()
const mockCreate = jest.fn()
const mockResendSend = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    recoveryCase: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
    dunningEmail: { create: (...args: unknown[]) => mockCreate(...args) },
  },
}))

jest.mock('@/lib/resend', () => ({
  resend: {
    emails: { send: (...args: unknown[]) => mockResendSend(...args) },
  },
}))

jest.mock('@/emails/dunning-email', () => ({
  DunningEmail: jest.fn(() => null),
  getSubjectForStep: jest.fn((step: number, company: string) => {
    const subjects: Record<number, string> = {
      1: `${company}: There was a problem with your payment`,
      2: `${company}: Action needed: update your payment method`,
      3: `${company}: Final notice before account suspension`,
    }
    return subjects[step]
  }),
}))

const RECOVERY_CASE_ID = 'rc_test123'
const BASE_URL = 'https://app.dunnmaster.com/update-payment'

const mockRecoveryCase = {
  id: RECOVERY_CASE_ID,
  customerEmail: 'customer@example.com',
  business: {
    brandingSettings: {
      companyName: 'Acme Corp',
      primaryColor: '#ff6600',
      logoUrl: 'https://acme.com/logo.png',
      supportEmail: 'help@acme.com',
    },
  },
}

describe('scheduleDunningEmails', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-04-05T12:00:00Z'))

    mockFindUnique.mockResolvedValue(mockRecoveryCase)
    mockResendSend.mockResolvedValue({ data: { id: 'resend_email_123' } })
    mockCreate.mockImplementation(({ data }) => Promise.resolve({ id: `de_${data.sequenceNumber}`, ...data }))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('creates 3 email records with correct scheduledAt offsets (day 1, 4, 7)', async () => {
    const emails = await scheduleDunningEmails(RECOVERY_CASE_ID, BASE_URL)

    expect(emails).toHaveLength(3)
    expect(mockCreate).toHaveBeenCalledTimes(3)

    const day0 = new Date('2026-04-05T12:00:00Z')
    const day3 = new Date('2026-04-08T12:00:00Z')
    const day6 = new Date('2026-04-11T12:00:00Z')

    expect(mockCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({
        sequenceNumber: 1,
        scheduledAt: day0,
      }),
    }))

    expect(mockCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({
        sequenceNumber: 2,
        scheduledAt: day3,
      }),
    }))

    expect(mockCreate).toHaveBeenNthCalledWith(3, expect.objectContaining({
      data: expect.objectContaining({
        sequenceNumber: 3,
        scheduledAt: day6,
      }),
    }))
  })

  it('uses correct subject lines per step', async () => {
    await scheduleDunningEmails(RECOVERY_CASE_ID, BASE_URL)

    expect(mockCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({
        subject: 'Acme Corp: There was a problem with your payment',
      }),
    }))

    expect(mockCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({
        subject: 'Acme Corp: Action needed: update your payment method',
      }),
    }))

    expect(mockCreate).toHaveBeenNthCalledWith(3, expect.objectContaining({
      data: expect.objectContaining({
        subject: 'Acme Corp: Final notice before account suspension',
      }),
    }))
  })

  it('uses correct template types (FRIENDLY_NOTICE, URGENCY, FINAL_WARNING)', async () => {
    await scheduleDunningEmails(RECOVERY_CASE_ID, BASE_URL)

    expect(mockCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({ templateType: 'FRIENDLY_NOTICE' }),
    }))

    expect(mockCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({ templateType: 'URGENCY' }),
    }))

    expect(mockCreate).toHaveBeenNthCalledWith(3, expect.objectContaining({
      data: expect.objectContaining({ templateType: 'FINAL_WARNING' }),
    }))
  })

  it('throws if recovery case is not found', async () => {
    mockFindUnique.mockResolvedValue(null)

    await expect(
      scheduleDunningEmails(RECOVERY_CASE_ID, BASE_URL)
    ).rejects.toThrow('Recovery case not found')
  })

  it('sends emails via resend with correct from address and scheduledAt', async () => {
    await scheduleDunningEmails(RECOVERY_CASE_ID, BASE_URL)

    expect(mockResendSend).toHaveBeenCalledTimes(3)

    expect(mockResendSend).toHaveBeenNthCalledWith(1, expect.objectContaining({
      from: 'Acme Corp <help@acme.com>',
      to: 'customer@example.com',
      subject: 'Acme Corp: There was a problem with your payment',
    }))
  })

  it('stores resendEmailId from send response', async () => {
    await scheduleDunningEmails(RECOVERY_CASE_ID, BASE_URL)

    expect(mockCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({
        resendEmailId: 'resend_email_123',
        status: 'SCHEDULED',
      }),
    }))
  })
})
