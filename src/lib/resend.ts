import { Resend } from 'resend'
import { env, features, isProduction } from '@/lib/env'

type SendArgs = Parameters<Resend['emails']['send']>[0]

/**
 * Minimal mock of the Resend client surface we use.
 * Only implements `emails.send` — extend as needed.
 */
const createMockResend = () => ({
  emails: {
    send: async (payload: SendArgs) => {
       
      console.log('[resend:mock] email would be sent →', {
        to: payload.to,
        subject: payload.subject,
      })
      return {
        data: { id: `mock_${Date.now()}` },
        error: null,
      }
    },
  },
})

export const resend = features.resend
  ? new Resend(env.RESEND_API_KEY)
  : (createMockResend() as unknown as Resend)

if (!features.resend && isProduction) {
  throw new Error('RESEND_API_KEY is required in production')
}
