import { NextRequest } from 'next/server'
import { validatePaymentUpdateToken } from '@/services/payment-update'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api-response'

export const GET = async (
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) => {
  const { token } = await params
  const result = await validatePaymentUpdateToken(token)

  if (!result) {
    return errorResponse('TOKEN_EXPIRED', 'This payment update link is no longer valid.', 410)
  }

  const { session } = result
  const { recoveryCase } = session
  const { business } = recoveryCase

  const setupIntent = await stripe.setupIntents.create(
    {
      customer: (recoveryCase as Record<string, unknown>).stripeCustomerId as string,
      usage: 'off_session',
    },
    { stripeAccount: business.stripeAccountId as string }
  )

  await prisma.paymentUpdateSession.update({
    where: { token },
    data: { stripeSetupIntentId: setupIntent.id },
  })

  return successResponse({
    clientSecret: setupIntent.client_secret,
    businessName: business.brandingSettings?.companyName ?? 'Your Service',
    logoUrl: business.brandingSettings?.logoUrl ?? null,
    primaryColor: business.brandingSettings?.primaryColor ?? '#0066ff',
    amountDue: (recoveryCase as Record<string, unknown>).amountDue,
    currency: (recoveryCase as Record<string, unknown>).currency,
  })
}
