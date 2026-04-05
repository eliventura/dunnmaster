# Research: Failed Payment Recovery (Dunning) MVP

**Feature Branch**: `001-dunning-mvp`
**Date**: 2026-04-05

## R1: Stripe Connect Account Type

**Decision**: Use Standard accounts with OAuth.

**Rationale**: Standard accounts let connected businesses manage their own
Stripe dashboard while Dunn Master reads payment data and retries invoices
via the API. Standard is the simplest Connect integration — no custom
onboarding UI required — and meets the "setup in 5 minutes" requirement.

**Alternatives considered**:
- Express accounts: Require Stripe-hosted onboarding, designed for
  marketplaces that control payouts. Not appropriate — businesses already
  have full Stripe accounts.
- Custom accounts: Maximum control but maximum complexity. Overkill for
  read + retry access.

**Implementation**:
- OAuth redirect: `https://connect.stripe.com/oauth/authorize?response_type=code&client_id={CLIENT_ID}&scope=read_write`
- Token exchange: `POST /oauth/token` with authorization code → returns `stripe_user_id`
- Next.js routes: `/api/stripe/connect/route.ts` (redirect) and `/api/stripe/connect/callback/route.ts` (token exchange)

## R2: Webhook Events

**Decision**: Subscribe to the following events per connected account:

| Event | Purpose |
|-------|---------|
| `invoice.payment_failed` | Primary trigger — creates recovery case |
| `invoice.payment_succeeded` | Closes recovery case, cancels pending emails |
| `customer.subscription.updated` | Detects cancellation during dunning |
| `charge.failed` | Provides detailed decline codes via `charge.failure_code` |

**Rationale**: `invoice.payment_failed` is the canonical event for
subscription billing failures. `charge.failed` supplements with granular
decline code data. `invoice.payment_succeeded` is essential for stopping
the dunning sequence on recovery.

**Implementation**: Single webhook endpoint at `/api/webhooks/stripe/route.ts`.
Verify signatures with `stripe.webhooks.constructEvent()`. Route by
`event.type` to handler functions.

## R3: Decline Code Classification

**Decision**: Two-tier classification (soft/hard) based on Stripe decline codes.

**Soft declines (retryable)**:
`insufficient_funds`, `processing_error`, `reenter_transaction`,
`try_again_later`, `approve_with_id`, `issuer_not_available`,
`generic_decline`

**Hard declines (do not retry)**:
`stolen_card`, `lost_card`, `card_not_supported`, `expired_card`,
`incorrect_cvc`, `incorrect_number`, `pickup_card`, `restricted_card`,
`do_not_honor`, `fraudulent`, `merchant_blacklist`, `invalid_account`,
`new_account_information_available`

**Rationale**: Retrying hard declines wastes attempts and can trigger
fraud monitoring. Industry consensus is clear on this split.

**Implementation**: Maintain a `HARD_DECLINE_CODES` set in a constants
file. Default unrecognized codes to soft decline (retry with caution).

## R4: Smart Retry Timing

**Decision**: Timezone-aware retries at optimal windows with Inngest
for job scheduling.

**Retry strategy for soft declines**:
- Retry 1: 3 days after failure, target 7 AM customer-local, Tue–Thu preferred
- Retry 2: 5 days after retry 1, same time targeting
- Retry 3: 7 days after retry 2, same time targeting
- Max 3 retries within a ~15-day window

**Optimal windows**:
- Best days: Tuesday through Thursday
- Best time: 6–8 AM customer-local timezone
- Avoid: Weekends, month-end (25th–31st), late night

**Timezone handling**: Store customer IANA timezone (e.g.,
`America/New_York`) from Stripe customer metadata or infer from
card issuing country. Compute next retry in customer-local time,
convert to UTC for scheduling.

**Alternatives considered**:
- Vercel Cron Jobs: Limited to fixed schedules, max 1/min granularity.
  Cannot do per-customer dynamic scheduling.
- pg_cron on Supabase: Requires manual polling, no built-in
  observability or retry logic.
- QStash: Works but lower-level — manual idempotency and serialization.

**Why Inngest**: Native Next.js integration, `step.sleepUntil()` for
precise future scheduling, automatic retries with backoff, event-driven
triggers, generous free tier. Fits the serverless Vercel architecture.

**Architecture**: Stripe webhook → Next.js route → Inngest event →
stepped function with `sleepUntil(nextRetryTimestamp)` →
`stripe.invoices.pay()` → loop or escalate to email sequence.

## R5: Programmatic Invoice Retry

**Decision**: Use `stripe.invoices.pay()` on the connected account.

**Implementation**:
```
const invoice = await stripe.invoices.pay('in_xxx', {
  payment_method: 'pm_xxx', // optional: use new method if updated
}, {
  stripeAccount: 'acct_connected',
})
```

**Note**: Disable Stripe's built-in Smart Retries in connected account
settings to avoid conflicts with Dunn Master's retry logic. Document
this in onboarding.

## R6: Dunning Email Sequence

**Decision**: Use Resend with `scheduledAt` for deferred email delivery.
React Email for templates.

**Sequence timing**:
- Email 1 (Day 1): "There was a problem with your payment" — friendly, no urgency
- Email 2 (Day 4): "Action needed: update your payment method" — service continuity focus
- Email 3 (Day 7): "Your account will be paused tomorrow" — clear consequence

**Implementation**:
- On `invoice.payment_failed` (after retries exhaust or hard decline),
  schedule all 3 emails immediately with `scheduledAt` offsets.
- Store each Resend `emailId` in `DunningEmail` Prisma model.
- On `invoice.payment_succeeded`, cancel all pending emails via
  `resend.emails.cancel(emailId)`.

**Template customization**: React Email components with props for
`companyName`, `logoUrl`, `brandColor`, `updatePaymentUrl`. Stored
per-business in `BrandingSettings` table.

**Alternative considered**: Using Inngest step functions for email
scheduling. Rejected because Resend's native `scheduledAt` is simpler
and avoids maintaining additional Inngest functions for emails.

## R7: Hosted Payment Update Page

**Decision**: Use Stripe SetupIntent + Payment Element for custom
branded pages. Fall back to Stripe Customer Portal for simpler cases.

**Custom page flow**:
1. Generate a `SetupIntent` for the customer: `stripe.setupIntents.create({ customer })`
2. Create a `PaymentUpdateSession` with expiring token (48h default)
3. Render `<PaymentElement>` on the hosted page at `/update-payment/[token]`
4. On submit: `stripe.confirmSetup()` → update default payment method:
   `stripe.customers.update('cus_xxx', { invoice_settings: { default_payment_method: 'pm_new' } })`
5. Immediately schedule a retry of the failed invoice

**Security**: Token is a signed JWT with expiration. Single-use flag
in database. No authentication required (the token IS the auth).

**Rationale**: Custom page allows business branding (Growth/Scale plans).
Stripe Customer Portal is simpler but not brandable.

## R8: Job Scheduling Architecture

**Decision**: Inngest as the primary job orchestrator.

**Functions needed**:
1. `payment-retry` — Receives failed payment event, schedules retries
   with `step.sleepUntil()`, calls Stripe retry API
2. `recovery-case-timeout` — After 14 days, marks unrecovered cases
   as failed

**Note**: Email scheduling uses Resend's native `scheduledAt` instead
of Inngest to keep the architecture simple (Principle V: Simplicity).

## Summary of Technology Decisions

| Concern | Decision |
|---------|----------|
| Stripe integration | Standard Connect with OAuth |
| Webhook endpoint | Single route, signature-verified |
| Decline classification | Two-tier (soft/hard) from decline codes |
| Retry scheduling | Inngest step functions with `sleepUntil()` |
| Retry timing | Timezone-aware, Tue–Thu 7 AM local, 3 attempts |
| Invoice retry API | `stripe.invoices.pay()` on connected account |
| Email delivery | Resend with `scheduledAt` + React Email templates |
| Email cancellation | `resend.emails.cancel(emailId)` on recovery |
| Payment update page | SetupIntent + Payment Element (brandable) |
| Job orchestration | Inngest (event-driven, serverless-native) |
