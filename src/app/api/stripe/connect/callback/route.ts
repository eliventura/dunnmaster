import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { PRICING_TIERS } from '@/constants/pricing-tiers'

export const GET = async (request: NextRequest) => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL!
  const settingsUrl = `${baseUrl}/settings/stripe`

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.redirect(`${baseUrl}/login`)
    }

    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(
        `${settingsUrl}?error=${encodeURIComponent(error)}`
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${settingsUrl}?error=missing_params`
      )
    }

    const storedState = request.cookies.get('stripe_oauth_state')?.value
    if (!storedState || storedState !== state) {
      return NextResponse.redirect(
        `${settingsUrl}?error=invalid_state`
      )
    }

    const tokenResponse = await stripe.oauth.token({
      grant_type: 'authorization_code',
      code,
    })

    const {
      stripe_user_id: stripeAccountId,
      access_token: stripeAccessToken,
      refresh_token: stripeRefreshToken,
    } = tokenResponse

    if (!stripeAccountId) {
      return NextResponse.redirect(
        `${settingsUrl}?error=no_account_id`
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    const companyName = user?.name || user?.email?.split('@')[0] || 'My Business'

    const starterTier = PRICING_TIERS.STARTER

    const business = await prisma.business.upsert({
      where: { userId: session.user.id },
      update: {
        stripeAccountId,
        stripeAccessToken,
        stripeRefreshToken,
        stripeConnectedAt: new Date(),
        monitoringActive: true,
      },
      create: {
        userId: session.user.id,
        stripeAccountId,
        stripeAccessToken,
        stripeRefreshToken,
        stripeConnectedAt: new Date(),
        monitoringActive: true,
      },
    })

    await prisma.brandingSettings.upsert({
      where: { businessId: business.id },
      update: {},
      create: {
        businessId: business.id,
        companyName,
      },
    })

    await prisma.subscriptionPlan.upsert({
      where: { businessId: business.id },
      update: {},
      create: {
        businessId: business.id,
        tier: 'STARTER',
        stripePriceId: '',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        mrrLimit: starterTier.mrrLimit,
      },
    })

    const response = NextResponse.redirect(`${settingsUrl}?connected=true`)
    response.cookies.delete('stripe_oauth_state')

    return response
  } catch (err) {
    console.error('[Stripe Connect Callback] Error:', err)
    return NextResponse.redirect(
      `${settingsUrl}?error=connection_failed`
    )
  }
}
