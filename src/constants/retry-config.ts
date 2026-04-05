export const RETRY_CONFIG = {
  maxAttempts: 3,
  intervals: [3, 5, 7] as const, // days after previous attempt
  optimalHours: { start: 6, end: 8 }, // customer-local time
  preferredDays: [2, 3, 4] as const, // Tue, Wed, Thu (0=Sun)
  avoidMonthEnd: { start: 25, end: 31 },
  recoveryWindowDays: 14,
} as const

export type RetryConfig = typeof RETRY_CONFIG
