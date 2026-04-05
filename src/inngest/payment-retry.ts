import { inngest } from '@/lib/inngest'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { computeNextRetryTime, shouldSkipRetries } from '@/services/retry'
import { RETRY_CONFIG } from '@/constants/retry-config'

export const paymentRetry = inngest.createFunction(
  { id: 'payment-retry', triggers: [{ event: 'dunning/payment.failed' }] },
  async ({ event, step }) => {
    const { recoveryCaseId, declineType, customerTimezone } = event.data

    if (shouldSkipRetries(declineType)) {
      // Hard decline - skip to email phase
      await step.run('skip-to-email', async () => {
        await prisma.recoveryCase.update({
          where: { id: recoveryCaseId },
          data: { status: 'EMAILING', phase: 'EMAIL' },
        })
      })
      return { skippedToEmail: true }
    }

    // Update status to RETRYING
    await step.run('set-retrying', async () => {
      await prisma.recoveryCase.update({
        where: { id: recoveryCaseId },
        data: { status: 'RETRYING' },
      })
    })

    for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
      const retryTime = computeNextRetryTime(customerTimezone, attempt)

      // Create retry attempt record
      await step.run(`create-attempt-${attempt}`, async () => {
        await prisma.retryAttempt.create({
          data: {
            recoveryCaseId,
            attemptNumber: attempt,
            scheduledAt: retryTime,
            status: 'SCHEDULED',
          },
        })
      })

      // Sleep until retry time
      await step.sleepUntil(`wait-for-retry-${attempt}`, retryTime)

      // Execute retry
      const result = await step.run(`execute-retry-${attempt}`, async () => {
        const recoveryCase = await prisma.recoveryCase.findUnique({
          where: { id: recoveryCaseId },
          include: { business: true },
        })
        if (!recoveryCase || recoveryCase.status === 'RECOVERED' || recoveryCase.status === 'CANCELLED') {
          return { cancelled: true, succeeded: false, failed: false } as const
        }

        await prisma.retryAttempt.update({
          where: { recoveryCaseId_attemptNumber: { recoveryCaseId, attemptNumber: attempt } },
          data: { status: 'EXECUTING', executedAt: new Date() },
        })

        try {
          await stripe.invoices.pay(recoveryCase.stripeInvoiceId, {}, {
            stripeAccount: recoveryCase.business.stripeAccountId!,
          })

          await prisma.retryAttempt.update({
            where: { recoveryCaseId_attemptNumber: { recoveryCaseId, attemptNumber: attempt } },
            data: { status: 'SUCCEEDED' },
          })

          await prisma.recoveryCase.update({
            where: { id: recoveryCaseId },
            data: { status: 'RECOVERED', recoveredAt: new Date(), phase: 'COMPLETE' },
          })

          return { cancelled: false, succeeded: true, failed: false } as const
        } catch (err: unknown) {
          const stripeErr = err as { code?: string; message?: string }
          await prisma.retryAttempt.update({
            where: { recoveryCaseId_attemptNumber: { recoveryCaseId, attemptNumber: attempt } },
            data: {
              status: 'FAILED',
              failureCode: stripeErr.code ?? 'unknown',
              failureMessage: stripeErr.message ?? 'Payment retry failed',
            },
          })
          return { cancelled: false, succeeded: false, failed: true, code: stripeErr.code } as const
        }
      })

      if (result.cancelled || result.succeeded) return result
    }

    // All retries exhausted - escalate to email
    await step.run('escalate-to-email', async () => {
      await prisma.recoveryCase.update({
        where: { id: recoveryCaseId },
        data: { status: 'EMAILING', phase: 'EMAIL' },
      })
    })

    return { escalatedToEmail: true }
  }
)
