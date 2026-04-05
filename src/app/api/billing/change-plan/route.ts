import { NextRequest } from 'next/server'
import { getAuthenticatedBusiness } from '@/lib/auth-middleware'
import { successResponse, errorResponse } from '@/lib/api-response'
import { changePlan } from '@/services/billing'
import type { PlanTier } from '@/generated/prisma/client'

const VALID_TIERS: PlanTier[] = ['STARTER', 'GROWTH', 'SCALE']

export const POST = async (request: NextRequest) => {
  const result = await getAuthenticatedBusiness()
  if ('error' in result) return result.error

  const body = await request.json()
  const { tier } = body as { tier: string }

  if (!tier || !VALID_TIERS.includes(tier as PlanTier)) {
    return errorResponse(
      'INVALID_TIER',
      `Invalid tier. Must be one of: ${VALID_TIERS.join(', ')}`,
      400
    )
  }

  const plan = result.business.subscriptionPlan
  if (!plan) return errorResponse('NOT_FOUND', 'No subscription plan found', 404)

  if (plan.tier === tier) {
    return errorResponse('SAME_TIER', 'Already on this plan', 400)
  }

  try {
    const changeResult = await changePlan(result.business.id, tier as PlanTier)
    return successResponse(changeResult)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to change plan'
    return errorResponse('PLAN_CHANGE_FAILED', message, 500)
  }
}
