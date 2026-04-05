'use client'

import { useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { TierConfig } from '@/constants/pricing-tiers'
import type { PlanTier } from '@/generated/prisma/client'

interface PlanCardProps {
  tierConfig: TierConfig
  currentTier: PlanTier
  onChangePlan: (tier: PlanTier) => Promise<void>
}

const formatPrice = (cents: number) => `$${(cents / 100).toFixed(0)}`

const getFeaturesList = (config: TierConfig): string[] => {
  const features: string[] = []
  if (config.mrrLimit === -1) {
    features.push('Unlimited MRR monitoring')
  } else {
    features.push(`Up to ${formatPrice(config.mrrLimit)} MRR monitored`)
  }
  if (config.maxEmailSequences === -1) {
    features.push('Unlimited email sequences')
  } else {
    features.push(`${config.maxEmailSequences} email sequences`)
  }
  if (config.customBranding) features.push('Custom branding')
  if (config.customDomain) features.push('Custom domain')
  if (config.apiAccess) features.push('API access')
  return features
}

const PlanCard = ({ tierConfig, currentTier, onChangePlan }: PlanCardProps) => {
  const [loading, setLoading] = useState(false)
  const isCurrent = currentTier === tierConfig.tier
  const tierOrder: PlanTier[] = ['STARTER', 'GROWTH', 'SCALE']
  const currentIndex = tierOrder.indexOf(currentTier)
  const cardIndex = tierOrder.indexOf(tierConfig.tier)
  const isUpgrade = cardIndex > currentIndex
  const features = getFeaturesList(tierConfig)

  const handleClick = async () => {
    setLoading(true)
    try {
      await onChangePlan(tierConfig.tier)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className={isCurrent ? 'ring-2 ring-primary' : ''}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{tierConfig.name}</CardTitle>
          {isCurrent && <Badge variant="default">Current Plan</Badge>}
        </div>
        <CardDescription>
          <span className="text-2xl font-bold text-foreground">
            {formatPrice(tierConfig.price)}
          </span>
          <span className="text-muted-foreground">/mo</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-sm">
              <span className="text-green-500">&#10003;</span>
              {feature}
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        {isCurrent ? (
          <Button variant="outline" className="w-full" disabled>
            Current Plan
          </Button>
        ) : (
          <Button
            variant={isUpgrade ? 'default' : 'outline'}
            className="w-full"
            onClick={handleClick}
            disabled={loading}
          >
            {loading ? 'Processing...' : isUpgrade ? 'Upgrade' : 'Downgrade'}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

export { PlanCard }
