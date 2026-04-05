import { prisma } from '@/lib/prisma'
import type { DashboardMetrics } from '@/types/recovery'

export const getDashboardMetrics = async (businessId: string): Promise<DashboardMetrics> => {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [activeCases, recoveredThisMonth, failedThisMonth] = await Promise.all([
    prisma.recoveryCase.findMany({
      where: {
        businessId,
        status: { in: ['PENDING', 'RETRYING', 'EMAILING'] },
      },
      select: { amountDue: true, currency: true },
    }),
    prisma.recoveryCase.count({
      where: {
        businessId,
        status: 'RECOVERED',
        recoveredAt: { gte: startOfMonth },
      },
    }),
    prisma.recoveryCase.count({
      where: {
        businessId,
        status: 'FAILED',
        failedAt: { gte: startOfMonth },
      },
    }),
  ])

  const mrrAtRisk = activeCases.reduce((sum, c) => sum + c.amountDue, 0)

  const recoveredCases = await prisma.recoveryCase.findMany({
    where: {
      businessId,
      status: 'RECOVERED',
      recoveredAt: { gte: startOfMonth },
    },
    select: { amountDue: true },
  })
  const mrrRecovered = recoveredCases.reduce((sum, c) => sum + c.amountDue, 0)

  const totalResolved = recoveredThisMonth + failedThisMonth
  const recoveryRate = totalResolved > 0 ? recoveredThisMonth / totalResolved : 0

  return {
    mrrAtRisk,
    mrrRecovered,
    recoveryRate,
    activeCases: activeCases.length,
    recoveredThisMonth,
    failedThisMonth,
    currency: activeCases[0]?.currency ?? 'usd',
  }
}
