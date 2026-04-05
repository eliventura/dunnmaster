import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedBusiness } from '@/lib/auth-middleware'
import { successResponse, errorResponse } from '@/lib/api-response'

export const GET = async () => {
  const result = await getAuthenticatedBusiness()
  if ('error' in result) return result.error

  const branding = result.business.brandingSettings
  if (!branding) return errorResponse('NOT_FOUND', 'Branding settings not found', 404)

  return successResponse({
    companyName: branding.companyName,
    logoUrl: branding.logoUrl,
    primaryColor: branding.primaryColor,
    accentColor: branding.accentColor,
    supportEmail: branding.supportEmail,
  })
}

export const PUT = async (request: NextRequest) => {
  const result = await getAuthenticatedBusiness()
  if ('error' in result) return result.error

  const body = await request.json()

  const updated = await prisma.brandingSettings.update({
    where: { businessId: result.business.id },
    data: {
      ...(body.companyName !== undefined && { companyName: body.companyName }),
      ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl }),
      ...(body.primaryColor !== undefined && { primaryColor: body.primaryColor }),
      ...(body.accentColor !== undefined && { accentColor: body.accentColor }),
      ...(body.supportEmail !== undefined && { supportEmail: body.supportEmail }),
    },
  })

  return successResponse(updated)
}
