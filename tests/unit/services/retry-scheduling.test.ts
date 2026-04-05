import { computeNextRetryTime } from '@/services/retry'

// Fixed reference: Monday 2026-04-06 at 12:00 UTC
const MOCK_NOW = new Date('2026-04-06T12:00:00Z').getTime()

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(MOCK_NOW)
})

afterEach(() => {
  jest.useRealTimers()
})

const getHourInTimezone = (date: Date, tz: string): number => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  return parseInt(parts.find(p => p.type === 'hour')?.value ?? '-1')
}

const getDayOfWeek = (date: Date): number => date.getDay()

describe('computeNextRetryTime', () => {
  const tz = 'America/New_York'

  it('returns a date approximately 3 days after now for attempt 1', () => {
    const fromDate = new Date(MOCK_NOW)
    const result = computeNextRetryTime(tz, 1, fromDate)

    const diffMs = result.getTime() - fromDate.getTime()
    const diffDays = diffMs / (24 * 60 * 60 * 1000)

    // Should be around 3 days, but may shift for preferred day targeting
    expect(diffDays).toBeGreaterThanOrEqual(2)
    expect(diffDays).toBeLessThanOrEqual(6)
  })

  it('returns a date approximately 5 days after from date for attempt 2', () => {
    const fromDate = new Date(MOCK_NOW)
    const result = computeNextRetryTime(tz, 2, fromDate)

    const diffMs = result.getTime() - fromDate.getTime()
    const diffDays = diffMs / (24 * 60 * 60 * 1000)

    expect(diffDays).toBeGreaterThanOrEqual(4)
    expect(diffDays).toBeLessThanOrEqual(8)
  })

  it('returns a date approximately 7 days after from date for attempt 3', () => {
    const fromDate = new Date(MOCK_NOW)
    const result = computeNextRetryTime(tz, 3, fromDate)

    const diffMs = result.getTime() - fromDate.getTime()
    const diffDays = diffMs / (24 * 60 * 60 * 1000)

    expect(diffDays).toBeGreaterThanOrEqual(6)
    expect(diffDays).toBeLessThanOrEqual(10)
  })

  it('targets 7 AM in the customer timezone', () => {
    const result = computeNextRetryTime(tz, 1, new Date(MOCK_NOW))
    const hour = getHourInTimezone(result, tz)

    expect(hour).toBe(7)
  })

  it('targets 7 AM in a different timezone (Asia/Tokyo)', () => {
    const result = computeNextRetryTime('Asia/Tokyo', 1, new Date(MOCK_NOW))
    const hour = getHourInTimezone(result, 'Asia/Tokyo')

    expect(hour).toBe(7)
  })

  it('prefers Tue-Thu (avoids weekends, Mon, Fri)', () => {
    // Test across multiple attempts to verify day preference
    const preferredDays = [2, 3, 4] // Tue, Wed, Thu

    for (let attempt = 1; attempt <= 3; attempt++) {
      const result = computeNextRetryTime(tz, attempt, new Date(MOCK_NOW))
      const day = getDayOfWeek(result)

      expect(preferredDays).toContain(day)
    }
  })

  it('shifts Saturday to Tuesday', () => {
    // 2026-04-08 (Wed) + 3 days = 2026-04-11 (Sat)
    // Should shift to Tue 2026-04-14
    const wednesday = new Date('2026-04-08T12:00:00Z')
    const result = computeNextRetryTime(tz, 1, wednesday)
    const day = getDayOfWeek(result)

    expect([2, 3, 4]).toContain(day)
  })

  it('shifts Sunday to Tuesday', () => {
    // 2026-04-09 (Thu) + 3 days = 2026-04-12 (Sun)
    // Should shift to Tue
    const thursday = new Date('2026-04-09T12:00:00Z')
    const result = computeNextRetryTime(tz, 1, thursday)
    const day = getDayOfWeek(result)

    expect([2, 3, 4]).toContain(day)
  })

  it('uses current date when fromDate is not provided', () => {
    const result = computeNextRetryTime(tz, 1)
    const diffMs = result.getTime() - MOCK_NOW
    const diffDays = diffMs / (24 * 60 * 60 * 1000)

    expect(diffDays).toBeGreaterThanOrEqual(2)
    expect(diffDays).toBeLessThanOrEqual(6)
  })
})
