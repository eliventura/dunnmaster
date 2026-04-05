import { RETRY_CONFIG } from '@/constants/retry-config'

export const computeNextRetryTime = (
  customerTimezone: string,
  attemptNumber: number,
  fromDate = new Date()
): Date => {
  // Get interval for this attempt (3, 5, or 7 days)
  const intervalDays = RETRY_CONFIG.intervals[attemptNumber - 1] ?? 7

  // Add interval days
  const targetDate = new Date(fromDate.getTime() + intervalDays * 24 * 60 * 60 * 1000)

  // Target 7 AM in customer timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: customerTimezone,
    hour: 'numeric',
    hour12: false,
  })
  const parts = formatter.formatToParts(targetDate)
  const currentHour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '12')
  const hourDiff = 7 - currentHour
  targetDate.setHours(targetDate.getHours() + hourDiff)

  // If it's a weekend or Mon/Fri, shift to preferred Tue-Thu
  const day = targetDate.getDay()
  if (day === 0) targetDate.setDate(targetDate.getDate() + 2) // Sun -> Tue
  if (day === 6) targetDate.setDate(targetDate.getDate() + 3) // Sat -> Tue
  if (day === 1) targetDate.setDate(targetDate.getDate() + 1) // Mon -> Tue
  if (day === 5) targetDate.setDate(targetDate.getDate() - 1) // Fri -> Thu

  return targetDate
}

export const shouldSkipRetries = (declineType: string): boolean =>
  declineType === 'HARD'
