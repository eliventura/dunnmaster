export const createMockStripeEvent = (
  type: string,
  data: Record<string, unknown> = {},
  account = 'acct_test123'
) => ({
  id: `evt_${Math.random().toString(36).slice(2)}`,
  type,
  data: { object: data },
  account,
})

export const createMockInvoice = (overrides: Record<string, unknown> = {}) => ({
  id: 'in_test123',
  customer: 'cus_test123',
  subscription: 'sub_test123',
  amount_due: 4999,
  currency: 'usd',
  status: 'open',
  charge: {
    failure_code: 'insufficient_funds',
    failure_message: 'Your card has insufficient funds.',
    outcome: { reason: 'insufficient_funds' },
  },
  ...overrides,
})

export const mockStripe = {
  invoices: {
    pay: jest.fn().mockResolvedValue({ id: 'in_test123', status: 'paid' }),
    retrieve: jest.fn().mockResolvedValue(createMockInvoice()),
  },
  customers: {
    update: jest.fn().mockResolvedValue({ id: 'cus_test123' }),
  },
  setupIntents: {
    create: jest.fn().mockResolvedValue({ id: 'seti_test', client_secret: 'seti_test_secret' }),
  },
  oauth: {
    token: jest.fn().mockResolvedValue({
      stripe_user_id: 'acct_test123',
      access_token: 'sk_test_connected',
      refresh_token: 'rt_test',
    }),
    deauthorize: jest.fn().mockResolvedValue({ stripe_user_id: 'acct_test123' }),
  },
  webhooks: {
    constructEvent: jest.fn(),
  },
}
