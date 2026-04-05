import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import {
  createRecoveryCase,
  closeRecoveryCase,
  handleSubscriptionUpdate,
} from '@/services/recovery'

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!

export const POST = async (request: NextRequest) => {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    )
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[Webhook] Signature verification failed:', err)
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }

  const existingEvent = await prisma.webhookEvent.findUnique({
    where: { stripeEventId: event.id },
  })

  if (existingEvent) {
    return NextResponse.json({ received: true, deduplicated: true })
  }

  const stripeAccountId = event.account ?? ''

  await prisma.webhookEvent.create({
    data: {
      stripeEventId: event.id,
      eventType: event.type,
      stripeAccountId,
      payload: JSON.parse(JSON.stringify(event.data.object)),
    },
  })

  const business = stripeAccountId
    ? await prisma.business.findUnique({
        where: { stripeAccountId },
      })
    : null

  if (!business) {
    console.warn(`[Webhook] No business found for account: ${stripeAccountId}`)
    return NextResponse.json({ received: true })
  }

  try {
    switch (event.type) {
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const lastError = invoice.last_finalization_error
        const declineCode = lastError?.code ?? 'generic_decline'

        await createRecoveryCase(business.id, invoice, declineCode)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        await closeRecoveryCase(business.id, invoice.id)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdate(
          business.id,
          subscription.id,
          subscription.status
        )
        break
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`)
    }
  } catch (err) {
    console.error(`[Webhook] Error processing ${event.type}:`, err)
  }

  return NextResponse.json({ received: true })
}
