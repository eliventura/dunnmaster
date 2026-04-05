import crypto from 'crypto'
import { NextRequest } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse } from '@/lib/api-response'
import { getAuthenticatedBusiness } from '@/lib/auth-middleware'
import { pauseActiveCases } from '@/services/recovery'

export const POST = async (_request: NextRequest) => {
  const result = await getAuthenticatedBusiness()
  if ('error' in result) return result.error

  const { business } = result

  if (business.stripeAccountId) {
    return errorResponse(
      'ALREADY_CONNECTED',
      'Stripe account is already connected',
      409
    )
  }

  const state = crypto.randomBytes(32).toString('hex')

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.STRIPE_CONNECT_CLIENT_ID!,
    scope: 'read_write',
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/stripe/connect/callback`,
    state,
    'stripe_user[business_type]': 'company',
  })

  const url = `https://connect.stripe.com/oauth/authorize?${params.toString()}`

  const response = successResponse({ url, state })
  response.cookies.set('stripe_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  })

  return response
}

export const DELETE = async (_request: NextRequest) => {
  const result = await getAuthenticatedBusiness()
  if ('error' in result) return result.error

  const { business } = result

  if (!business.stripeAccountId) {
    return errorResponse(
      'NOT_CONNECTED',
      'No Stripe account connected',
      400
    )
  }

  await stripe.oauth.deauthorize({
    client_id: process.env.STRIPE_CONNECT_CLIENT_ID!,
    stripe_user_id: business.stripeAccountId,
  })

  const pausedCount = await pauseActiveCases(business.id)

  await prisma.business.update({
    where: { id: business.id },
    data: {
      stripeAccountId: null,
      stripeAccessToken: null,
      stripeRefreshToken: null,
      stripeConnectedAt: null,
      monitoringActive: false,
    },
  })

  return successResponse({
    disconnected: true,
    pausedCases: pausedCount,
  })
}
