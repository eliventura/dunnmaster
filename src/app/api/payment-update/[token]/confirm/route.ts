import { NextRequest } from 'next/server'
import { validatePaymentUpdateToken, markSessionUsed } from '@/services/payment-update'
import { stripe } from '@/lib/stripe'
import { successResponse, errorResponse } from '@/lib/api-response'

export const POST = async (
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) => {
  const { token } = await params
  const result = await validatePaymentUpdateToken(token)

  if (!result) {
    return errorResponse('TOKEN_EXPIRED', 'This payment update link is no longer valid.', 410)
  }

  const { setupIntentId } = await req.json()
  const { session } = result
  const { recoveryCase } = session
  const { business } = recoveryCase
  const stripeAccount = business.stripeAccountId as string
  const customerId = (recoveryCase as Record<string, unknown>).stripeCustomerId as string
  const invoiceId = (recoveryCase as Record<string, unknown>).stripeInvoiceId as string

  const setupIntent = await stripe.setupIntents.retrieve(
    setupIntentId,
    undefined,
    { stripeAccount }
  )

  const paymentMethodId = setupIntent.payment_method as string

  await stripe.customers.update(
    customerId,
    { invoice_settings: { default_payment_method: paymentMethodId } },
    { stripeAccount }
  )

  await markSessionUsed(token)

  await stripe.invoices.pay(invoiceId, {}, { stripeAccount })

  return successResponse({ success: true })
}
