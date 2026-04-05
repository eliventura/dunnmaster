export const SOFT_DECLINE_CODES = new Set([
  'insufficient_funds',
  'processing_error',
  'reenter_transaction',
  'try_again_later',
  'approve_with_id',
  'issuer_not_available',
  'generic_decline',
])

export const HARD_DECLINE_CODES = new Set([
  'stolen_card',
  'lost_card',
  'card_not_supported',
  'expired_card',
  'incorrect_cvc',
  'incorrect_number',
  'pickup_card',
  'restricted_card',
  'do_not_honor',
  'fraudulent',
  'merchant_blacklist',
  'invalid_account',
  'new_account_information_available',
])

export const classifyDeclineCode = (code: string): 'SOFT' | 'HARD' =>
  HARD_DECLINE_CODES.has(code) ? 'HARD' : 'SOFT'
