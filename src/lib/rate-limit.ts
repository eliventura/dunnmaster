const rateMap = new Map<string, { count: number; resetAt: number }>()

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

export const checkRateLimit = (
  key: string,
  maxRequests = 60,
  windowMs = 60_000
): RateLimitResult => {
  const now = Date.now()
  const entry = rateMap.get(key)

  if (!entry || now > entry.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs }
  }

  entry.count++

  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt }
}
