# Data Model: Failed Payment Recovery (Dunning) MVP

**Feature Branch**: `001-dunning-mvp`
**Date**: 2026-04-05

## Entity Relationship Overview

```text
User (NextAuth)
  └── Business (1:1)
        ├── BrandingSettings (1:1)
        ├── SubscriptionPlan (1:1)
        └── RecoveryCase (1:N)
              ├── RetryAttempt (1:N)
              ├── DunningEmail (1:N)
              └── PaymentUpdateSession (1:N)

WebhookEvent (standalone — idempotency log)
```

## Entities

### User

NextAuth-managed user account.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | PK, cuid | NextAuth default |
| name | String? | | |
| email | String | Unique, not null | |
| emailVerified | DateTime? | | NextAuth default |
| image | String? | | |
| createdAt | DateTime | Default: now() | |
| updatedAt | DateTime | Auto-updated | |

**Relations**: Has one `Business`, plus NextAuth `Account` and `Session` models.

### Business

The SaaS customer organization using Dunn Master.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | PK, cuid | |
| userId | String | Unique, FK → User | One business per user |
| stripeAccountId | String? | Unique | Stripe Connect acct ID (`acct_xxx`) |
| stripeAccessToken | String? | Encrypted | OAuth access token |
| stripeRefreshToken | String? | Encrypted | OAuth refresh token |
| stripeConnectedAt | DateTime? | | When Connect OAuth completed |
| monitoringActive | Boolean | Default: false | Whether webhook listening is active |
| timezone | String | Default: "UTC" | IANA timezone for default scheduling |
| createdAt | DateTime | Default: now() | |
| updatedAt | DateTime | Auto-updated | |

**Relations**: Belongs to `User`. Has one `BrandingSettings`, one `SubscriptionPlan`, many `RecoveryCase`.

### BrandingSettings

Per-business email and payment page customization.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | PK, cuid | |
| businessId | String | Unique, FK → Business | |
| companyName | String | Not null | Shown in emails/payment page |
| logoUrl | String? | | URL to uploaded logo |
| primaryColor | String | Default: "#6366f1" | Hex color for email CTA buttons |
| accentColor | String | Default: "#4f46e5" | Secondary brand color |
| supportEmail | String? | | Reply-to for dunning emails |
| customDomain | String? | | Custom domain for payment page (Growth+) |
| createdAt | DateTime | Default: now() | |
| updatedAt | DateTime | Auto-updated | |

**Relations**: Belongs to `Business`.

### SubscriptionPlan

The Dunn Master tier the business subscribes to.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | PK, cuid | |
| businessId | String | Unique, FK → Business | |
| tier | Enum | STARTER, GROWTH, SCALE | |
| stripeSubscriptionId | String? | Unique | Dunn Master's own Stripe sub |
| stripePriceId | String | Not null | Active price ID |
| currentPeriodStart | DateTime | Not null | |
| currentPeriodEnd | DateTime | Not null | |
| mrrLimit | Int | Not null | In cents. Starter: 1000000, Growth: 5000000, Scale: unlimited |
| currentMrrMonitored | Int | Default: 0 | In cents. Running total of monitored MRR |
| status | Enum | ACTIVE, PAST_DUE, CANCELLED | |
| createdAt | DateTime | Default: now() | |
| updatedAt | DateTime | Auto-updated | |

**Relations**: Belongs to `Business`.

**Tier limits**:
| Tier | MRR Limit | Email Sequences | Custom Branding | API Access |
|------|-----------|-----------------|-----------------|------------|
| STARTER | $10K | 3 per sequence | Basic (name + color) | No |
| GROWTH | $50K | Unlimited | Full (logo, domain) | No |
| SCALE | Unlimited | Unlimited | Full | Yes |

### RecoveryCase

A single failed payment being actively recovered.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | PK, cuid | |
| businessId | String | FK → Business | |
| stripeInvoiceId | String | Not null | Stripe invoice ID (`in_xxx`) |
| stripeCustomerId | String | Not null | End customer (`cus_xxx`) |
| stripeSubscriptionId | String | Not null | Subscription being recovered |
| customerEmail | String | Not null | For email delivery |
| customerTimezone | String | Default: "UTC" | IANA timezone |
| amountDue | Int | Not null | In cents |
| currency | String | Default: "usd" | ISO 4217 |
| declineCode | String | Not null | Stripe decline code |
| declineType | Enum | SOFT, HARD | Classified from decline code |
| status | Enum | PENDING, RETRYING, EMAILING, RECOVERED, FAILED, CANCELLED, PAUSED | |
| phase | Enum | RETRY, EMAIL, COMPLETE | Current phase in recovery flow |
| recoveredAt | DateTime? | | When payment succeeded |
| failedAt | DateTime? | | When case exhausted all options |
| expiresAt | DateTime | Not null | 14 days from creation |
| createdAt | DateTime | Default: now() | |
| updatedAt | DateTime | Auto-updated | |

**Unique constraint**: `(businessId, stripeInvoiceId)` — one case per invoice per business.

**Relations**: Belongs to `Business`. Has many `RetryAttempt`, `DunningEmail`, `PaymentUpdateSession`.

**State transitions**:
```text
PENDING → RETRYING (soft decline, retries scheduled)
PENDING → EMAILING (hard decline, skip retries)
RETRYING → RECOVERED (retry succeeded)
RETRYING → EMAILING (all retries exhausted)
EMAILING → RECOVERED (customer updated payment)
EMAILING → FAILED (14-day window expired)
Any active state → CANCELLED (subscription cancelled by business)
Any active state → PAUSED (Stripe account disconnected)
```

### RetryAttempt

An individual payment retry within a recovery case.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | PK, cuid | |
| recoveryCaseId | String | FK → RecoveryCase | |
| attemptNumber | Int | Not null | 1, 2, or 3 |
| scheduledAt | DateTime | Not null | UTC time for retry |
| executedAt | DateTime? | | When actually executed |
| status | Enum | SCHEDULED, EXECUTING, SUCCEEDED, FAILED, CANCELLED | |
| stripePaymentIntentId | String? | | Result PI if created |
| failureCode | String? | | Decline code if failed again |
| failureMessage | String? | | Human-readable failure reason |
| inngestEventId | String? | | For tracking/cancellation |
| createdAt | DateTime | Default: now() | |

**Relations**: Belongs to `RecoveryCase`.

### DunningEmail

A scheduled or sent email in the dunning sequence.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | PK, cuid | |
| recoveryCaseId | String | FK → RecoveryCase | |
| sequenceNumber | Int | Not null | 1, 2, or 3 |
| templateType | Enum | FRIENDLY_NOTICE, URGENCY, FINAL_WARNING | |
| resendEmailId | String? | | Resend API email ID for cancellation |
| scheduledAt | DateTime | Not null | When email should be sent |
| sentAt | DateTime? | | Actual send time |
| status | Enum | SCHEDULED, SENT, CANCELLED, FAILED | |
| subject | String | Not null | Rendered subject line |
| toEmail | String | Not null | Recipient email |
| createdAt | DateTime | Default: now() | |

**Relations**: Belongs to `RecoveryCase`.

### PaymentUpdateSession

Secure session for customer to update payment method without login.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | PK, cuid | |
| recoveryCaseId | String | FK → RecoveryCase | |
| token | String | Unique, not null | Signed JWT token |
| stripeSetupIntentId | String? | | Created when page loads |
| expiresAt | DateTime | Not null | Default: 48 hours from creation |
| usedAt | DateTime? | | When customer submitted new card |
| status | Enum | ACTIVE, USED, EXPIRED | |
| createdAt | DateTime | Default: now() | |

**Relations**: Belongs to `RecoveryCase`.

### WebhookEvent

Idempotency log for Stripe webhook processing.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | String | PK, cuid | |
| stripeEventId | String | Unique, not null | Stripe event ID (`evt_xxx`) |
| eventType | String | Not null | e.g., `invoice.payment_failed` |
| stripeAccountId | String | Not null | Connected account that triggered it |
| processedAt | DateTime | Default: now() | |
| payload | Json? | | Raw event data for debugging |

**Purpose**: Before processing any webhook, check if `stripeEventId`
exists in this table. If yes, skip (idempotent). If no, insert and process.

## Indexes

| Table | Columns | Type | Purpose |
|-------|---------|------|---------|
| Business | stripeAccountId | Unique | Lookup by Connect account |
| RecoveryCase | businessId, stripeInvoiceId | Unique | Deduplication |
| RecoveryCase | businessId, status | Index | Dashboard queries |
| RecoveryCase | expiresAt, status | Index | Timeout job queries |
| RetryAttempt | recoveryCaseId, attemptNumber | Unique | Prevent duplicate attempts |
| RetryAttempt | scheduledAt, status | Index | Scheduler queries |
| DunningEmail | recoveryCaseId, sequenceNumber | Unique | Prevent duplicate emails |
| DunningEmail | scheduledAt, status | Index | Scheduler queries |
| PaymentUpdateSession | token | Unique | Token lookup |
| WebhookEvent | stripeEventId | Unique | Idempotency check |

## Enums

```text
DeclineType: SOFT | HARD
RecoveryCaseStatus: PENDING | RETRYING | EMAILING | RECOVERED | FAILED | CANCELLED | PAUSED
RecoveryPhase: RETRY | EMAIL | COMPLETE
RetryStatus: SCHEDULED | EXECUTING | SUCCEEDED | FAILED | CANCELLED
EmailTemplateType: FRIENDLY_NOTICE | URGENCY | FINAL_WARNING
EmailStatus: SCHEDULED | SENT | CANCELLED | FAILED
SessionStatus: ACTIVE | USED | EXPIRED
PlanTier: STARTER | GROWTH | SCALE
PlanStatus: ACTIVE | PAST_DUE | CANCELLED
```
