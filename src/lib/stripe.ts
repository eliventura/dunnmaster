import Stripe from 'stripe'
import { env, features, isProduction } from '@/lib/env'

if (!features.stripe && isProduction) {
  throw new Error('STRIPE_SECRET_KEY is required in production')
}

if (!features.stripe) {
   
  console.warn(
    '[stripe] STRIPE_SECRET_KEY not set — using placeholder. Real Stripe calls will fail.',
  )
}

export const stripe = new Stripe(
  env.STRIPE_SECRET_KEY || 'sk_test_placeholder_for_build',
  { apiVersion: '2025-04-30.basil' },
)
