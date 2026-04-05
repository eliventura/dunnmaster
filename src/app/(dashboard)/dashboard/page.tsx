import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { getDashboardMetrics } from '@/services/dashboard'
import { MetricCard } from '@/components/dashboard/metric-card'
import { RecoveryCaseTable } from '@/components/dashboard/recovery-case-table'
import { EmptyState } from '@/components/dashboard/empty-state'

const formatCurrency = (amountCents: number, currency: string) => {
  const amount = amountCents / 100
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount)
}

const formatPercent = (rate: number) =>
  `${(rate * 100).toFixed(1)}%`

const DashboardPage = async () => {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const business = await prisma.business.findUnique({
    where: { userId: session.user.id },
  })

  if (!business) redirect('/settings/stripe')

  const [metrics, recentCases] = await Promise.all([
    getDashboardMetrics(business.id),
    prisma.recoveryCase.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        retryAttempts: { orderBy: { attemptNumber: 'asc' } },
        dunningEmails: { orderBy: { sequenceNumber: 'asc' } },
        paymentUpdateSessions: { orderBy: { createdAt: 'desc' } },
      },
    }),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Recovery Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Monitor failed payments and recovery progress
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="MRR at Risk"
          value={formatCurrency(metrics.mrrAtRisk, metrics.currency)}
          subtitle={`${metrics.activeCases} active cases`}
        />
        <MetricCard
          title="MRR Recovered"
          value={formatCurrency(metrics.mrrRecovered, metrics.currency)}
          subtitle={`${metrics.recoveredThisMonth} cases this month`}
        />
        <MetricCard
          title="Recovery Rate"
          value={formatPercent(metrics.recoveryRate)}
          subtitle={`${metrics.recoveredThisMonth} recovered / ${metrics.recoveredThisMonth + metrics.failedThisMonth} resolved`}
        />
        <MetricCard
          title="Active Cases"
          value={String(metrics.activeCases)}
          subtitle={`${metrics.failedThisMonth} failed this month`}
        />
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Cases</h2>
        {recentCases.length > 0 ? (
          <RecoveryCaseTable cases={recentCases} />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  )
}

export default DashboardPage
