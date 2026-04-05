import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { inngest } from '@/lib/inngest'
import { classifyDeclineCode } from '@/constants/decline-codes'
import { RETRY_CONFIG } from '@/constants/retry-config'
import type {
  RecoveryCase,
  RecoveryCaseStatus,
} from '@/generated/prisma/client'

const ACTIVE_STATUSES: RecoveryCaseStatus[] = ['PENDING', 'RETRYING', 'EMAILING']

export const createRecoveryCase = async (
  businessId: string,
  invoice: Stripe.Invoice,
  declineCode: string
): Promise<RecoveryCase> => {
  const declineType = classifyDeclineCode(declineCode)

  const phase = declineType === 'HARD' ? 'EMAIL' as const : 'RETRY' as const

  const expiresAt = new Date(
    Date.now() + RETRY_CONFIG.recoveryWindowDays * 24 * 60 * 60 * 1000
  )

  const recoveryCase = await prisma.recoveryCase.upsert({
    where: {
      businessId_stripeInvoiceId: {
        businessId,
        stripeInvoiceId: invoice.id,
      },
    },
    update: {
      declineCode,
      declineType,
      status: 'PENDING',
      phase,
      expiresAt,
    },
    create: {
      businessId,
      stripeInvoiceId: invoice.id,
      stripeCustomerId: invoice.customer as string ?? '',
      stripeSubscriptionId: (invoice as unknown as { subscription: string | null }).subscription ?? '',
      customerEmail: invoice.customer_email ?? '',
      amountDue: invoice.amount_due,
      currency: invoice.currency,
      declineCode,
      declineType,
      status: 'PENDING',
      phase,
      expiresAt,
    },
  })

  await inngest.send({
    name: 'dunning/payment.failed',
    data: {
      businessId,
      recoveryCaseId: recoveryCase.id,
      declineType,
      customerTimezone: recoveryCase.customerTimezone,
    },
  })

  return recoveryCase
}

export const closeRecoveryCase = async (
  businessId: string,
  stripeInvoiceId: string
): Promise<RecoveryCase | null> => {
  const recoveryCase = await prisma.recoveryCase.findUnique({
    where: {
      businessId_stripeInvoiceId: {
        businessId,
        stripeInvoiceId,
      },
    },
  })

  if (!recoveryCase) return null

  const terminalStatuses: RecoveryCaseStatus[] = ['RECOVERED', 'FAILED', 'CANCELLED']
  if (terminalStatuses.includes(recoveryCase.status)) return recoveryCase

  const [updatedCase] = await prisma.$transaction([
    prisma.recoveryCase.update({
      where: { id: recoveryCase.id },
      data: {
        status: 'RECOVERED',
        recoveredAt: new Date(),
      },
    }),
    prisma.retryAttempt.updateMany({
      where: {
        recoveryCaseId: recoveryCase.id,
        status: 'SCHEDULED',
      },
      data: { status: 'CANCELLED' },
    }),
    prisma.dunningEmail.updateMany({
      where: {
        recoveryCaseId: recoveryCase.id,
        status: 'SCHEDULED',
      },
      data: { status: 'CANCELLED' },
    }),
  ])

  return updatedCase
}

export const handleSubscriptionUpdate = async (
  businessId: string,
  subscriptionId: string,
  subscriptionStatus: string
): Promise<void> => {
  const cancelStatuses = ['canceled', 'unpaid']
  if (!cancelStatuses.includes(subscriptionStatus)) return

  const activeCases = await prisma.recoveryCase.findMany({
    where: {
      businessId,
      stripeSubscriptionId: subscriptionId,
      status: { in: ACTIVE_STATUSES },
    },
  })

  if (activeCases.length === 0) return

  const caseIds = activeCases.map((c) => c.id)

  await prisma.$transaction([
    prisma.recoveryCase.updateMany({
      where: { id: { in: caseIds } },
      data: { status: 'CANCELLED' },
    }),
    prisma.retryAttempt.updateMany({
      where: {
        recoveryCaseId: { in: caseIds },
        status: 'SCHEDULED',
      },
      data: { status: 'CANCELLED' },
    }),
    prisma.dunningEmail.updateMany({
      where: {
        recoveryCaseId: { in: caseIds },
        status: 'SCHEDULED',
      },
      data: { status: 'CANCELLED' },
    }),
  ])
}

export const pauseActiveCases = async (
  businessId: string
): Promise<number> => {
  const result = await prisma.recoveryCase.updateMany({
    where: {
      businessId,
      status: { in: ACTIVE_STATUSES },
    },
    data: { status: 'PAUSED' },
  })

  return result.count
}
