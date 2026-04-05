import type {
  RecoveryCase,
  RetryAttempt,
  DunningEmail,
  PaymentUpdateSession,
  Business,
  BrandingSettings,
  SubscriptionPlan,
} from '@/generated/prisma/client'

export type RecoveryCaseWithRelations = RecoveryCase & {
  retryAttempts: RetryAttempt[]
  dunningEmails: DunningEmail[]
  paymentUpdateSessions: PaymentUpdateSession[]
}

export type BusinessWithRelations = Business & {
  brandingSettings: BrandingSettings | null
  subscriptionPlan: SubscriptionPlan | null
}

export interface DashboardMetrics {
  mrrAtRisk: number
  mrrRecovered: number
  recoveryRate: number
  activeCases: number
  recoveredThisMonth: number
  failedThisMonth: number
  currency: string
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}
