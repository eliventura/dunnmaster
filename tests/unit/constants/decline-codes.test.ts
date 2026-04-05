import {
  SOFT_DECLINE_CODES,
  HARD_DECLINE_CODES,
  classifyDeclineCode,
} from '@/constants/decline-codes'

describe('classifyDeclineCode', () => {
  it('returns SOFT for all soft decline codes', () => {
    for (const code of SOFT_DECLINE_CODES) {
      expect(classifyDeclineCode(code)).toBe('SOFT')
    }
  })

  it('returns HARD for all hard decline codes', () => {
    for (const code of HARD_DECLINE_CODES) {
      expect(classifyDeclineCode(code)).toBe('HARD')
    }
  })

  it('defaults to SOFT for unknown decline codes', () => {
    expect(classifyDeclineCode('totally_unknown_code')).toBe('SOFT')
    expect(classifyDeclineCode('')).toBe('SOFT')
    expect(classifyDeclineCode('some_new_stripe_code')).toBe('SOFT')
  })
})
