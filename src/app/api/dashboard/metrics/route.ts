import { getAuthenticatedBusiness } from '@/lib/auth-middleware'
import { successResponse } from '@/lib/api-response'
import { getDashboardMetrics } from '@/services/dashboard'

export const GET = async () => {
  const result = await getAuthenticatedBusiness()
  if ('error' in result) return result.error

  const metrics = await getDashboardMetrics(result.business.id)
  return successResponse(metrics)
}
