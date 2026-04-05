import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { PRICING_TIERS } from '@/constants/pricing-tiers'
import { getUsagePercentage, shouldShowUpgradePrompt } from '@/services/billing'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { UsageBar } from '@/components/settings/usage-bar'
import { BillingPlans } from './billing-plans'

const BillingSettingsPage = async () => {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const business = await prisma.business.findUnique({
    where: { userId: session.user.id },
    include: { subscriptionPlan: true },
  })

  if (!business) redirect('/login')

  const plan = business.subscriptionPlan
  if (!plan) redirect('/login')

  const tierConfig = PRICING_TIERS[plan.tier]
  const usagePercent = getUsagePercentage(plan.currentMrrMonitored, tierConfig.mrrLimit)
  const showUpgrade = shouldShowUpgradePrompt(plan.currentMrrMonitored, tierConfig.mrrLimit)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing &amp; Plan</h1>
        <p className="text-muted-foreground">
          Manage your subscription plan and monitor usage.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Plan: {tierConfig.name}</CardTitle>
          <CardDescription>
            Your billing period ends on{' '}
            {plan.currentPeriodEnd.toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UsageBar
            currentMrr={plan.currentMrrMonitored}
            limit={tierConfig.mrrLimit}
          />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Plans</h2>
        <BillingPlans
          currentTier={plan.tier}
          usagePercent={usagePercent}
          showUpgradePrompt={showUpgrade}
        />
      </div>
    </div>
  )
}

export default BillingSettingsPage
