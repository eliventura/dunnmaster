import { z } from 'zod'

/**
 * Environment variable schema.
 *
 * Rules:
 * - Required in production → `.min(1)` unconditionally.
 * - Optional in dev (mockable) → `.optional()`, then enforced in prod via superRefine.
 * - `NEXT_PUBLIC_*` vars must be listed in `clientEnv` too so they ship to the browser.
 */
const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Database — required everywhere
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Auth — required everywhere
  AUTH_SECRET: z.string().min(1, 'AUTH_SECRET is required'),
  NEXTAUTH_URL: z.string().url().optional(),

  // Google OAuth — optional (credentials login still works without it)
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),

  // Stripe — optional in dev (mocked), required in prod
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_CONNECT_CLIENT_ID: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_STARTER_PRICE_ID: z.string().optional(),
  STRIPE_GROWTH_PRICE_ID: z.string().optional(),
  STRIPE_SCALE_PRICE_ID: z.string().optional(),

  // Resend — optional in dev (mocked), required in prod
  RESEND_API_KEY: z.string().optional(),

  // Inngest — optional in dev (uses local dev server), required in prod
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),
})

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
})

const processEnv = {
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
  AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_CONNECT_CLIENT_ID: process.env.STRIPE_CONNECT_CLIENT_ID,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_STARTER_PRICE_ID: process.env.STRIPE_STARTER_PRICE_ID,
  STRIPE_GROWTH_PRICE_ID: process.env.STRIPE_GROWTH_PRICE_ID,
  STRIPE_SCALE_PRICE_ID: process.env.STRIPE_SCALE_PRICE_ID,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY,
  INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
}

const merged = serverSchema.merge(clientSchema)

const parsed = merged.safeParse(processEnv)

if (!parsed.success) {
  console.error(
    '❌ Invalid environment variables:',
    JSON.stringify(parsed.error.flatten().fieldErrors, null, 2),
  )
  throw new Error('Invalid environment variables')
}

const data = parsed.data

// Enforce production-only requirements
if (data.NODE_ENV === 'production') {
  const missing: string[] = []
  if (!data.STRIPE_SECRET_KEY) missing.push('STRIPE_SECRET_KEY')
  if (!data.STRIPE_WEBHOOK_SECRET) missing.push('STRIPE_WEBHOOK_SECRET')
  if (!data.RESEND_API_KEY) missing.push('RESEND_API_KEY')
  if (!data.INNGEST_EVENT_KEY) missing.push('INNGEST_EVENT_KEY')
  if (!data.INNGEST_SIGNING_KEY) missing.push('INNGEST_SIGNING_KEY')
  if (missing.length > 0) {
    throw new Error(
      `Missing required production environment variables: ${missing.join(', ')}`,
    )
  }
}

export const env = data

export const isProduction = data.NODE_ENV === 'production'
export const isDevelopment = data.NODE_ENV === 'development'
export const isTest = data.NODE_ENV === 'test'

/**
 * Feature flags derived from env: true when the real service is configured,
 * false when we should fall back to a mock/no-op in dev.
 */
export const features = {
  stripe: Boolean(data.STRIPE_SECRET_KEY),
  resend: Boolean(data.RESEND_API_KEY),
  googleAuth: Boolean(data.AUTH_GOOGLE_ID && data.AUTH_GOOGLE_SECRET),
  inngestCloud: Boolean(data.INNGEST_EVENT_KEY && data.INNGEST_SIGNING_KEY),
} as const
