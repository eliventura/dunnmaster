import { inngest } from '@/lib/inngest'
import { prisma } from '@/lib/prisma'
import { RETRY_CONFIG } from '@/constants/retry-config'

export const recoveryTimeout = inngest.createFunction(
  { id: 'recovery-case-timeout', triggers: [{ event: 'dunning/payment.failed' }] },
  async ({ event, step }) => {
    const { recoveryCaseId } = event.data

    // Sleep for full recovery window
    await step.sleep('wait-for-timeout', `${RETRY_CONFIG.recoveryWindowDays}d`)

    await step.run('check-and-expire', async () => {
      const recoveryCase = await prisma.recoveryCase.findUnique({
        where: { id: recoveryCaseId },
      })

      if (!recoveryCase) return

      const activeStatuses = ['PENDING', 'RETRYING', 'EMAILING']
      if (!activeStatuses.includes(recoveryCase.status)) return

      await prisma.recoveryCase.update({
        where: { id: recoveryCaseId },
        data: { status: 'FAILED', failedAt: new Date(), phase: 'COMPLETE' },
      })
    })
  }
)
