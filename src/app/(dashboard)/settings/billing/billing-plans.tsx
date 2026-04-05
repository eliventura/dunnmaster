'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PRICING_TIERS } from '@/constants/pricing-tiers'
import { PlanCard } from '@/components/settings/plan-card'
import { UpgradePrompt } from '@/components/settings/upgrade-prompt'
import type { PlanTier } from '@/generated/prisma/client'

interface BillingPlansProps {
  currentTier: PlanTier
  usagePercent: number
  showUpgradePrompt: boolean
}

const BillingPlans = ({ currentTier, usagePercent, showUpgradePrompt }: BillingPlansProps) => {
  const router = useRouter()
  const [showPrompt, setShowPrompt] = useState(showUpgradePrompt)
  const tiers: PlanTier[] = ['STARTER', 'GROWTH', 'SCALE']

  const handleChangePlan = async (tier: PlanTier) => {
    const res = await fetch('/api/billing/change-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier }),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error?.message ?? 'Failed to change plan')
    }

    router.refresh()
  }

  return (
    <>
      {showPrompt && (
        <UpgradePrompt
          currentTier={currentTier}
          usagePercent={usagePercent}
          onUpgrade={handleChangePlan}
          onDismiss={() => setShowPrompt(false)}
        />
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {tiers.map((tier) => (
          <PlanCard
            key={tier}
            tierConfig={PRICING_TIERS[tier]}
            currentTier={currentTier}
            onChangePlan={handleChangePlan}
          />
        ))}
      </div>
    </>
  )
}

export { BillingPlans }
