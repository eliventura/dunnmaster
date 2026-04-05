import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { PRICING_TIERS, TIER_UPGRADE_THRESHOLD } from '@/constants/pricing-tiers'
import type { PlanTier } from '@/generated/prisma/client'

export const checkTierLimit = async (businessId: string, newAmountDue: number) => {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { businessId },
  })

  if (!plan) return { allowed: false, reason: 'No subscription plan found' }

  const tierConfig = PRICING_TIERS[plan.tier]
  if (tierConfig.mrrLimit === -1) return { allowed: true } // unlimited

  const newTotal = plan.currentMrrMonitored + newAmountDue
  if (newTotal > tierConfig.mrrLimit) {
    return {
      allowed: false,
      currentUsage: plan.currentMrrMonitored,
      limit: tierConfig.mrrLimit,
      tier: plan.tier,
      usagePercent: plan.currentMrrMonitored / tierConfig.mrrLimit,
    }
  }

  return { allowed: true }
}

export const getUsagePercentage = (currentMrr: number, limit: number): number => {
  if (limit === -1) return 0
  return currentMrr / limit
}

export const shouldShowUpgradePrompt = (currentMrr: number, limit: number): boolean => {
  if (limit === -1) return false
  return currentMrr / limit >= TIER_UPGRADE_THRESHOLD
}

export const changePlan = async (businessId: string, newTier: PlanTier) => {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { businessId },
    include: { business: true },
  })

  if (!plan || !plan.stripeSubscriptionId) {
    throw new Error('No active subscription found')
  }

  const newTierConfig = PRICING_TIERS[newTier]

  // Update Stripe subscription
  const subscription = await stripe.subscriptions.retrieve(plan.stripeSubscriptionId)
  const priceId = newTierConfig.tier === 'STARTER' ? process.env.STRIPE_STARTER_PRICE_ID!
    : newTierConfig.tier === 'GROWTH' ? process.env.STRIPE_GROWTH_PRICE_ID!
    : process.env.STRIPE_SCALE_PRICE_ID!

  await stripe.subscriptions.update(
    plan.stripeSubscriptionId,
    {
      items: [{
        id: subscription.items.data[0].id,
        price: priceId,
      }],
      proration_behavior: 'create_prorations',
    }
  )

  // Update local record
  await prisma.subscriptionPlan.update({
    where: { businessId },
    data: {
      tier: newTier,
      stripePriceId: priceId,
      mrrLimit: newTierConfig.mrrLimit === -1 ? 999999999 : newTierConfig.mrrLimit,
    },
  })

  return {
    previousTier: plan.tier,
    newTier,
    effectiveAt: new Date(),
  }
}

export const updateMrrMonitored = async (businessId: string, amountDelta: number) => {
  await prisma.subscriptionPlan.update({
    where: { businessId },
    data: { currentMrrMonitored: { increment: amountDelta } },
  })
}
