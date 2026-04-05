import { NextRequest } from 'next/server'
import { getAuthenticatedBusiness } from '@/lib/auth-middleware'
import { successResponse, errorResponse } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'

export const GET = async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const result = await getAuthenticatedBusiness()
  if ('error' in result) return result.error

  const { id } = await params

  const recoveryCase = await prisma.recoveryCase.findUnique({
    where: {
      id,
      businessId: result.business.id,
    },
    include: {
      retryAttempts: { orderBy: { attemptNumber: 'asc' } },
      dunningEmails: { orderBy: { sequenceNumber: 'asc' } },
      paymentUpdateSessions: { orderBy: { createdAt: 'desc' } },
    },
  })

  if (!recoveryCase) {
    return errorResponse('NOT_FOUND', 'Recovery case not found', 404)
  }

  return successResponse(recoveryCase)
}
