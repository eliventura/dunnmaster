# API Contracts: Failed Payment Recovery (Dunning) MVP

**Feature Branch**: `001-dunning-mvp`
**Date**: 2026-04-05

## Response Envelope

All API routes return a consistent JSON shape:

**Success**:
```json
{
  "data": { ... },
  "meta": { "timestamp": "2026-04-05T12:00:00Z" }
}
```

**Error**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description"
  }
}
```

## Authentication

All routes under `/api/` (except webhooks and public routes) require a
valid NextAuth session. Unauthenticated requests return `401`.

---

## Stripe Connect

### POST /api/stripe/connect

Initiates Stripe Connect OAuth flow. Returns the redirect URL.

**Auth**: Required
**Response** `200`:
```json
{
  "data": {
    "redirectUrl": "https://connect.stripe.com/oauth/authorize?..."
  }
}
```

### GET /api/stripe/connect/callback

Handles OAuth callback from Stripe. Exchanges code for tokens, stores
connected account, activates monitoring.

**Auth**: Required (session cookie)
**Query params**: `code` (string), `state` (string)
**Response** `200`:
```json
{
  "data": {
    "stripeAccountId": "acct_xxx",
    "monitoringActive": true
  }
}
```
**Error** `400`: Invalid or expired code.

### DELETE /api/stripe/connect

Disconnects Stripe account. Pauses all active recovery cases.

**Auth**: Required
**Response** `200`:
```json
{
  "data": {
    "disconnected": true,
    "pausedCases": 3
  }
}
```

---

## Webhooks

### POST /api/stripe/webhooks

Receives Stripe webhook events. Verifies signature. Idempotent.

**Auth**: Stripe signature verification (no session)
**Headers**: `stripe-signature` (required)
**Body**: Raw Stripe event payload

**Handled events**:
| Event | Action |
|-------|--------|
| `invoice.payment_failed` | Create or update recovery case |
| `invoice.payment_succeeded` | Close recovery case, cancel emails |
| `customer.subscription.updated` | Cancel case if subscription cancelled |

**Response** `200`: `{ "received": true }`
**Response** `400`: Invalid signature or malformed payload.

---

## Recovery Cases

### GET /api/recovery

Lists recovery cases for the authenticated business.

**Auth**: Required
**Query params**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| status | string? | all | Filter by status |
| page | number? | 1 | Pagination |
| limit | number? | 20 | Items per page (max 100) |

**Response** `200`:
```json
{
  "data": {
    "cases": [
      {
        "id": "clxxx",
        "stripeInvoiceId": "in_xxx",
        "customerEmail": "customer@example.com",
        "amountDue": 4999,
        "currency": "usd",
        "declineType": "SOFT",
        "status": "RETRYING",
        "phase": "RETRY",
        "nextAction": "Retry #2 scheduled for 2026-04-08T12:00:00Z",
        "createdAt": "2026-04-05T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

### GET /api/recovery/[id]

Get details of a specific recovery case with retry attempts and emails.

**Auth**: Required
**Response** `200`:
```json
{
  "data": {
    "id": "clxxx",
    "stripeInvoiceId": "in_xxx",
    "customerEmail": "customer@example.com",
    "amountDue": 4999,
    "currency": "usd",
    "declineCode": "insufficient_funds",
    "declineType": "SOFT",
    "status": "RETRYING",
    "phase": "RETRY",
    "retryAttempts": [
      {
        "attemptNumber": 1,
        "scheduledAt": "2026-04-08T12:00:00Z",
        "status": "FAILED",
        "failureCode": "insufficient_funds"
      }
    ],
    "emails": [
      {
        "sequenceNumber": 1,
        "templateType": "FRIENDLY_NOTICE",
        "scheduledAt": "2026-04-12T14:00:00Z",
        "status": "SCHEDULED"
      }
    ],
    "createdAt": "2026-04-05T10:00:00Z"
  }
}
```

---

## Dashboard

### GET /api/dashboard/metrics

Returns aggregated recovery metrics for the authenticated business.

**Auth**: Required
**Response** `200`:
```json
{
  "data": {
    "mrrAtRisk": 125000,
    "mrrRecovered": 87500,
    "recoveryRate": 0.62,
    "activeCases": 15,
    "recoveredThisMonth": 23,
    "failedThisMonth": 8,
    "currency": "usd"
  }
}
```

---

## Payment Update (Public)

### GET /api/payment-update/[token]

Validates a payment update token and returns session info.

**Auth**: None (token is the auth)
**Response** `200`:
```json
{
  "data": {
    "valid": true,
    "clientSecret": "seti_xxx_secret_xxx",
    "businessName": "Acme Corp",
    "logoUrl": "https://...",
    "primaryColor": "#6366f1",
    "amountDue": 4999,
    "currency": "usd"
  }
}
```
**Error** `410`: Token expired or already used.

### POST /api/payment-update/[token]/confirm

Confirms payment method update and triggers immediate retry.

**Auth**: None (token is the auth)
**Body**:
```json
{
  "setupIntentId": "seti_xxx"
}
```
**Response** `200`:
```json
{
  "data": {
    "updated": true,
    "retryScheduled": true
  }
}
```

---

## Billing

### GET /api/billing

Returns current subscription plan details and usage.

**Auth**: Required
**Response** `200`:
```json
{
  "data": {
    "tier": "STARTER",
    "mrrLimit": 1000000,
    "currentMrrMonitored": 450000,
    "usagePercent": 0.45,
    "currentPeriodEnd": "2026-05-05T00:00:00Z",
    "status": "ACTIVE"
  }
}
```

### POST /api/billing/change-plan

Changes the subscription tier. Prorated at next billing cycle.

**Auth**: Required
**Body**:
```json
{
  "tier": "GROWTH"
}
```
**Response** `200`:
```json
{
  "data": {
    "previousTier": "STARTER",
    "newTier": "GROWTH",
    "effectiveAt": "2026-05-05T00:00:00Z",
    "prorationAmount": 3000
  }
}
```

---

## Settings

### GET /api/settings/branding

Returns current branding settings.

**Auth**: Required
**Response** `200`:
```json
{
  "data": {
    "companyName": "Acme Corp",
    "logoUrl": "https://...",
    "primaryColor": "#6366f1",
    "accentColor": "#4f46e5",
    "supportEmail": "billing@acme.com"
  }
}
```

### PUT /api/settings/branding

Updates branding settings.

**Auth**: Required
**Body**: Partial update of branding fields.
**Response** `200`: Updated branding object.

---

## Inngest Events (Internal)

These are not HTTP endpoints but Inngest event contracts:

| Event Name | Trigger | Payload |
|------------|---------|---------|
| `dunning/payment.failed` | Webhook handler | `{ businessId, recoveryCaseId, declineType, customerTimezone }` |
| `dunning/retry.scheduled` | Retry function | `{ recoveryCaseId, attemptNumber, scheduledAt }` |
| `dunning/payment.recovered` | Webhook handler | `{ businessId, recoveryCaseId, stripeInvoiceId }` |
| `dunning/case.expired` | Timeout function | `{ recoveryCaseId }` |
