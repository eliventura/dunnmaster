'use client'

import { useState } from 'react'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PRICING_TIERS } from '@/constants/pricing-tiers'
import type { PlanTier } from '@/generated/prisma/client'

interface UpgradePromptProps {
  currentTier: PlanTier
  usagePercent: number
  onUpgrade: (tier: PlanTier) => Promise<void>
  onDismiss: () => void
}

const getNextTier = (current: PlanTier): PlanTier | null => {
  if (current === 'STARTER') return 'GROWTH'
  if (current === 'GROWTH') return 'SCALE'
  return null
}

const formatPrice = (cents: number) => `$${(cents / 100).toFixed(0)}`

const UpgradePrompt = ({
  currentTier,
  usagePercent,
  onUpgrade,
  onDismiss,
}: UpgradePromptProps) => {
  const [loading, setLoading] = useState(false)
  const nextTier = getNextTier(currentTier)

  if (!nextTier) return null

  const currentConfig = PRICING_TIERS[currentTier]
  const nextConfig = PRICING_TIERS[nextTier]

  const handleUpgrade = async () => {
    setLoading(true)
    try {
      await onUpgrade(nextTier)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Time to Upgrade</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You are using <span className="font-semibold text-foreground">{Math.round(usagePercent * 100)}%</span> of
            your {currentConfig.name} plan limit.
          </p>
          <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
            <div>
              <p className="text-xs text-muted-foreground">Current Plan</p>
              <p className="font-semibold">{currentConfig.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatPrice(currentConfig.price)}/mo
              </p>
              <p className="text-sm text-muted-foreground">
                {currentConfig.mrrLimit === -1
                  ? 'Unlimited MRR'
                  : `Up to ${formatPrice(currentConfig.mrrLimit)} MRR`}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Recommended</p>
              <p className="font-semibold">{nextConfig.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatPrice(nextConfig.price)}/mo
              </p>
              <p className="text-sm text-muted-foreground">
                {nextConfig.mrrLimit === -1
                  ? 'Unlimited MRR'
                  : `Up to ${formatPrice(nextConfig.mrrLimit)} MRR`}
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onDismiss}>
            Not Now
          </Button>
          <Button className="flex-1" onClick={handleUpgrade} disabled={loading}>
            {loading ? 'Processing...' : 'Upgrade Now'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export { UpgradePrompt }
