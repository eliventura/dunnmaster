import { NextRequest } from 'next/server'
import { getAuthenticatedBusiness } from '@/lib/auth-middleware'
import { successResponse, errorResponse } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import type { RecoveryCaseStatus } from '@/generated/prisma/client'

const VALID_STATUSES: RecoveryCaseStatus[] = [
  'PENDING',
  'RETRYING',
  'EMAILING',
  'RECOVERED',
  'FAILED',
  'CANCELLED',
  'PAUSED',
]

export const GET = async (request: NextRequest) => {
  const result = await getAuthenticatedBusiness()
  if ('error' in result) return result.error

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))

  if (status && !VALID_STATUSES.includes(status as RecoveryCaseStatus)) {
    return errorResponse('INVALID_STATUS', `Invalid status: ${status}`)
  }

  const where = {
    businessId: result.business.id,
    ...(status ? { status: status as RecoveryCaseStatus } : {}),
  }

  const [cases, total] = await Promise.all([
    prisma.recoveryCase.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        retryAttempts: { orderBy: { attemptNumber: 'asc' } },
        dunningEmails: { orderBy: { sequenceNumber: 'asc' } },
      },
    }),
    prisma.recoveryCase.count({ where }),
  ])

  return successResponse({
    cases,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}
