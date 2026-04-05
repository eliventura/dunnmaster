import { getAuthenticatedBusiness } from '@/lib/auth-middleware'
import { successResponse, errorResponse } from '@/lib/api-response'
import { getUsagePercentage, shouldShowUpgradePrompt } from '@/services/billing'
import { PRICING_TIERS } from '@/constants/pricing-tiers'

export const GET = async () => {
  const result = await getAuthenticatedBusiness()
  if ('error' in result) return result.error

  const plan = result.business.subscriptionPlan
  if (!plan) return errorResponse('NOT_FOUND', 'No subscription plan found', 404)

  const tierConfig = PRICING_TIERS[plan.tier]
  const usagePercent = getUsagePercentage(plan.currentMrrMonitored, tierConfig.mrrLimit)
  const showUpgradePrompt = shouldShowUpgradePrompt(plan.currentMrrMonitored, tierConfig.mrrLimit)

  return successResponse({
    tier: plan.tier,
    tierName: tierConfig.name,
    price: tierConfig.price,
    currentMrrMonitored: plan.currentMrrMonitored,
    mrrLimit: tierConfig.mrrLimit,
    usagePercent,
    showUpgradePrompt,
    currentPeriodStart: plan.currentPeriodStart.toISOString(),
    currentPeriodEnd: plan.currentPeriodEnd.toISOString(),
    status: plan.status,
    features: {
      maxEmailSequences: tierConfig.maxEmailSequences,
      customBranding: tierConfig.customBranding,
      customDomain: tierConfig.customDomain,
      apiAccess: tierConfig.apiAccess,
    },
  })
}
