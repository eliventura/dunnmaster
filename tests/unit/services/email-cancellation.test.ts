import { cancelPendingEmails } from '@/services/dunning-email'

const mockFindMany = jest.fn()
const mockUpdateMany = jest.fn()
const mockResendCancel = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    dunningEmail: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
  },
}))

jest.mock('@/lib/resend', () => ({
  resend: {
    emails: { cancel: (...args: unknown[]) => mockResendCancel(...args) },
  },
}))

jest.mock('@/emails/dunning-email', () => ({
  DunningEmail: jest.fn(),
  getSubjectForStep: jest.fn(),
}))

const RECOVERY_CASE_ID = 'rc_test456'

describe('cancelPendingEmails', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUpdateMany.mockResolvedValue({ count: 0 })
  })

  it('finds SCHEDULED emails and calls resend.emails.cancel for each', async () => {
    const scheduledEmails = [
      { id: 'de_1', resendEmailId: 'resend_1', status: 'SCHEDULED' },
      { id: 'de_2', resendEmailId: 'resend_2', status: 'SCHEDULED' },
      { id: 'de_3', resendEmailId: 'resend_3', status: 'SCHEDULED' },
    ]
    mockFindMany.mockResolvedValue(scheduledEmails)
    mockResendCancel.mockResolvedValue({})

    const count = await cancelPendingEmails(RECOVERY_CASE_ID)

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { recoveryCaseId: RECOVERY_CASE_ID, status: 'SCHEDULED' },
    })

    expect(mockResendCancel).toHaveBeenCalledTimes(3)
    expect(mockResendCancel).toHaveBeenCalledWith('resend_1')
    expect(mockResendCancel).toHaveBeenCalledWith('resend_2')
    expect(mockResendCancel).toHaveBeenCalledWith('resend_3')

    expect(count).toBe(3)
  })

  it('updates status to CANCELLED', async () => {
    const scheduledEmails = [
      { id: 'de_1', resendEmailId: 'resend_1', status: 'SCHEDULED' },
    ]
    mockFindMany.mockResolvedValue(scheduledEmails)
    mockResendCancel.mockResolvedValue({})

    await cancelPendingEmails(RECOVERY_CASE_ID)

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { recoveryCaseId: RECOVERY_CASE_ID, status: 'SCHEDULED' },
      data: { status: 'CANCELLED' },
    })
  })

  it('does nothing if no scheduled emails exist', async () => {
    mockFindMany.mockResolvedValue([])

    const count = await cancelPendingEmails(RECOVERY_CASE_ID)

    expect(mockResendCancel).not.toHaveBeenCalled()
    expect(count).toBe(0)
  })

  it('handles resend cancel failures gracefully', async () => {
    const scheduledEmails = [
      { id: 'de_1', resendEmailId: 'resend_1', status: 'SCHEDULED' },
      { id: 'de_2', resendEmailId: 'resend_2', status: 'SCHEDULED' },
    ]
    mockFindMany.mockResolvedValue(scheduledEmails)
    mockResendCancel
      .mockRejectedValueOnce(new Error('Already sent'))
      .mockResolvedValueOnce({})

    const count = await cancelPendingEmails(RECOVERY_CASE_ID)

    expect(count).toBe(2)
    expect(mockUpdateMany).toHaveBeenCalled()
  })

  it('skips resend cancel for emails without resendEmailId', async () => {
    const scheduledEmails = [
      { id: 'de_1', resendEmailId: null, status: 'SCHEDULED' },
      { id: 'de_2', resendEmailId: 'resend_2', status: 'SCHEDULED' },
    ]
    mockFindMany.mockResolvedValue(scheduledEmails)
    mockResendCancel.mockResolvedValue({})

    await cancelPendingEmails(RECOVERY_CASE_ID)

    expect(mockResendCancel).toHaveBeenCalledTimes(1)
    expect(mockResendCancel).toHaveBeenCalledWith('resend_2')
  })
})
