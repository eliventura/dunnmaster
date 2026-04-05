export interface StripeConnectTokens {
  accessToken: string
  refreshToken: string
  stripeUserId: string
}

export interface WebhookEventPayload {
  id: string
  type: string
  data: {
    object: Record<string, unknown>
  }
  account?: string
}
