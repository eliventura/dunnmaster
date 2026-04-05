import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest'
import { paymentRetry } from '@/inngest/payment-retry'
import { recoveryTimeout } from '@/inngest/recovery-timeout'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [paymentRetry, recoveryTimeout],
})
