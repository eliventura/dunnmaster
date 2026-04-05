import { PlanTier } from '@/generated/prisma/client'

export interface TierConfig {
  tier: PlanTier
  name: string
  price: number // monthly in cents
  mrrLimit: number // in cents, -1 = unlimited
  maxEmailSequences: number // -1 = unlimited
  customBranding: boolean
  customDomain: boolean
  apiAccess: boolean
}

export const PRICING_TIERS: Record<PlanTier, TierConfig> = {
  STARTER: {
    tier: 'STARTER',
    name: 'Starter',
    price: 2900,
    mrrLimit: 1_000_000, // $10K
    maxEmailSequences: 3,
    customBranding: false,
    customDomain: false,
    apiAccess: false,
  },
  GROWTH: {
    tier: 'GROWTH',
    name: 'Growth',
    price: 5900,
    mrrLimit: 5_000_000, // $50K
    maxEmailSequences: -1,
    customBranding: true,
    customDomain: true,
    apiAccess: false,
  },
  SCALE: {
    tier: 'SCALE',
    name: 'Scale',
    price: 9900,
    mrrLimit: -1, // unlimited
    maxEmailSequences: -1,
    customBranding: true,
    customDomain: true,
    apiAccess: true,
  },
}

export const TIER_UPGRADE_THRESHOLD = 0.8 // 80% usage triggers upgrade prompt
