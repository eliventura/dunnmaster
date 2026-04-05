import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { errorResponse } from '@/lib/api-response'

export const getAuthenticatedBusiness = async () => {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: errorResponse('UNAUTHORIZED', 'Authentication required', 401) }
  }

  const business = await prisma.business.findUnique({
    where: { userId: session.user.id },
    include: { brandingSettings: true, subscriptionPlan: true },
  })

  if (!business) {
    return { error: errorResponse('NO_BUSINESS', 'No business account found', 404) }
  }

  return { business, userId: session.user.id }
}
