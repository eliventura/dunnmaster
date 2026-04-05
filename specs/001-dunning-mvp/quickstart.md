# Quickstart: Failed Payment Recovery (Dunning) MVP

**Feature Branch**: `001-dunning-mvp`
**Date**: 2026-04-05

## Prerequisites

- Node.js 18+
- PostgreSQL database (Supabase project)
- Stripe account with Connect enabled
- Resend account
- Inngest account (free tier)

## 1. Clone and Install

```bash
git clone <repo-url>
cd dunnmaster
npm install
```

## 2. Environment Setup

Copy the environment template and fill in values:

```bash
cp .env.example .env.local
```

Required variables:

```env
# Database
DATABASE_URL="postgresql://user:pass@host:5432/dunnmaster"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<generate with: openssl rand -base64 32>"

# Stripe
STRIPE_SECRET_KEY="sk_test_xxx"
STRIPE_PUBLISHABLE_KEY="pk_test_xxx"
STRIPE_CONNECT_CLIENT_ID="ca_xxx"
STRIPE_WEBHOOK_SECRET="whsec_xxx"

# Resend
RESEND_API_KEY="re_xxx"

# Inngest
INNGEST_EVENT_KEY="<from inngest dashboard>"
INNGEST_SIGNING_KEY="<from inngest dashboard>"
```

## 3. Database Setup

```bash
npx prisma generate
npx prisma db push
```

## 4. Run Development Server

```bash
npm run dev
```

App runs at `http://localhost:3000`.

## 5. Stripe Webhook Testing (Local)

Install and run the Stripe CLI for local webhook forwarding:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhooks
```

Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET` in `.env.local`.

## 6. Inngest Dev Server

Run the Inngest dev server alongside Next.js:

```bash
npx inngest-cli dev
```

Access the Inngest dashboard at `http://localhost:8288` to monitor
function executions, retries, and step states.

## 7. Verify Setup

1. Register a new account at `http://localhost:3000/register`
2. Connect a Stripe test account via the dashboard
3. Trigger a test failed payment:
   ```bash
   stripe trigger invoice.payment_failed
   ```
4. Verify a recovery case appears in the dashboard
5. Check Inngest dev dashboard for scheduled retry functions

## Test Commands

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# All tests with coverage
npm run test:coverage
```

## Key URLs (Development)

| URL | Purpose |
|-----|---------|
| `http://localhost:3000` | App |
| `http://localhost:3000/dashboard` | Recovery dashboard |
| `http://localhost:3000/settings/stripe` | Stripe Connect settings |
| `http://localhost:3000/update-payment/[token]` | Payment update page |
| `http://localhost:8288` | Inngest dev dashboard |
