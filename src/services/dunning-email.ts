import { prisma } from '@/lib/prisma'
import { resend } from '@/lib/resend'
import { DunningEmail, getSubjectForStep } from '@/emails/dunning-email'
import type { EmailTemplateType } from '@/generated/prisma/client'

const EMAIL_SEQUENCE: Array<{
  step: 1 | 2 | 3
  dayOffset: number
  templateType: EmailTemplateType
}> = [
  { step: 1, dayOffset: 0, templateType: 'FRIENDLY_NOTICE' },
  { step: 2, dayOffset: 3, templateType: 'URGENCY' },
  { step: 3, dayOffset: 6, templateType: 'FINAL_WARNING' },
]

export const scheduleDunningEmails = async (
  recoveryCaseId: string,
  updatePaymentBaseUrl: string
) => {
  const recoveryCase = await prisma.recoveryCase.findUnique({
    where: { id: recoveryCaseId },
    include: { business: { include: { brandingSettings: true } } },
  })

  if (!recoveryCase) throw new Error('Recovery case not found')

  const branding = recoveryCase.business.brandingSettings
  const companyName = branding?.companyName ?? 'Your Service'
  const brandColor = branding?.primaryColor ?? '#6366f1'
  const logoUrl = branding?.logoUrl ?? undefined
  const updatePaymentUrl = `${updatePaymentBaseUrl}/${recoveryCaseId}`

  const emails = []

  for (const { step, dayOffset, templateType } of EMAIL_SEQUENCE) {
    const scheduledAt = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000)
    const subject = getSubjectForStep(step, companyName)

    const { data } = await resend.emails.send({
      from: branding?.supportEmail
        ? `${companyName} <${branding.supportEmail}>`
        : `${companyName} <billing@dunnmaster.com>`,
      to: recoveryCase.customerEmail,
      subject,
      react: DunningEmail({
        companyName,
        logoUrl,
        brandColor,
        customerName: '',
        updatePaymentUrl,
        step,
      }),
      scheduledAt: scheduledAt.toISOString(),
    })

    const email = await prisma.dunningEmail.create({
      data: {
        recoveryCaseId,
        sequenceNumber: step,
        templateType,
        resendEmailId: data?.id ?? null,
        scheduledAt,
        subject,
        toEmail: recoveryCase.customerEmail,
        status: 'SCHEDULED',
      },
    })

    emails.push(email)
  }

  return emails
}

export const cancelPendingEmails = async (recoveryCaseId: string) => {
  const scheduledEmails = await prisma.dunningEmail.findMany({
    where: { recoveryCaseId, status: 'SCHEDULED' },
  })

  await Promise.all(
    scheduledEmails.map(async (email) => {
      if (email.resendEmailId) {
        try {
          await resend.emails.cancel(email.resendEmailId)
        } catch {
          // Email may have already been sent
        }
      }
    })
  )

  await prisma.dunningEmail.updateMany({
    where: { recoveryCaseId, status: 'SCHEDULED' },
    data: { status: 'CANCELLED' },
  })

  return scheduledEmails.length
}
