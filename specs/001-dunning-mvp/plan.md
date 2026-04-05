# Implementation Plan: Failed Payment Recovery (Dunning) MVP

**Branch**: `001-dunning-mvp` | **Date**: 2026-04-05 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-dunning-mvp/spec.md`

## Summary

Build a SaaS dunning tool that connects to businesses' Stripe accounts
via Connect OAuth, monitors for failed subscription payments, automatically
retries them at optimal times based on decline type and customer timezone,
sends escalating email sequences via Resend, and provides a hosted payment
update page. A dashboard shows MRR at risk, recovered revenue, and recovery
rates. Three pricing tiers (Starter/Growth/Scale) gate features and limits.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: Next.js 14+ (App Router), Prisma, Stripe SDK,
NextAuth, Resend, Inngest, Zustand, React Email, shadcn/ui, Tailwind CSS
**Storage**: PostgreSQL (Supabase)
**Testing**: Jest + React Testing Library
**Target Platform**: Vercel (serverless)
**Project Type**: Web service (SaaS)
**Performance Goals**: API routes < 500ms p95, webhook ack < 5s,
LCP < 2.5s, JS bundle < 200KB gzipped
**Constraints**: PCI compliant (Stripe Elements handles card data),
webhook idempotency required, 14-day recovery window
**Scale/Scope**: Initial target ~500 businesses, each monitoring up
to $50K MRR, ~10K recovery cases/month

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Type Safety — PASS

- TypeScript strict mode enabled in `tsconfig.json`
- Prisma-generated types for all database entities
- Stripe SDK provides full type definitions
- Shared types in `src/types/` for domain objects (decline codes, recovery states)
- No implicit `any` — enforced via ESLint `@typescript-eslint/no-explicit-any`

### II. Test Discipline — PASS

- Stripe webhook handlers tested with mocked Stripe events (`stripe.webhooks.constructEvent`)
- Recovery logic (decline classification, retry scheduling) covered by unit tests
- Dashboard components tested with React Testing Library
- Inngest functions tested with `inngest/test` utilities
- Email template rendering tested with React Email preview

### III. Security-First — PASS

- Stripe webhook signatures verified on every request
- Stripe Connect tokens stored encrypted in database
- Payment update page uses signed JWT tokens with expiration
- No raw card data — Stripe Elements handles PCI compliance
- All API routes protected by NextAuth sessions
- CSRF protection via Next.js defaults + SameSite cookies
- CSP headers configured in `next.config.js`

### IV. API Contract Stability — PASS

- RESTful API routes with consistent JSON response shapes
- Webhook handler is idempotent (deduplication by Stripe event ID)
- Error responses use structured `{ error: { code, message } }` format
- Stripe API versioning pinned in Stripe SDK configuration

### V. Simplicity — PASS

- Inngest replaces custom job queue infrastructure (one dependency vs building our own)
- Resend `scheduledAt` replaces email scheduling infrastructure
- Server Components by default; Client Components only for dashboard charts
  and Stripe Elements
- No premature abstractions — direct Prisma queries in service functions
- Three pricing tiers with simple boolean feature flags, not a complex
  permissions system

## Project Structure

### Documentation (this feature)

```text
specs/001-dunning-mvp/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   ├── settings/
│   │   │   ├── branding/
│   │   │   ├── billing/
│   │   │   └── stripe/
│   │   └── recovery/
│   ├── api/
│   │   ├── auth/[...nextauth]/
│   │   ├── stripe/
│   │   │   ├── connect/
│   │   │   ├── connect/callback/
│   │   │   └── webhooks/
│   │   ├── recovery/
│   │   ├── billing/
│   │   └── inngest/
│   └── update-payment/[token]/
├── components/
│   ├── ui/                    # shadcn/ui components
│   ├── dashboard/
│   ├── recovery/
│   └── settings/
├── emails/
│   ├── dunning-email.tsx      # React Email template
│   └── components/
├── inngest/
│   ├── client.ts
│   ├── payment-retry.ts
│   └── recovery-timeout.ts
├── lib/
│   ├── stripe.ts              # Stripe client + helpers
│   ├── resend.ts              # Resend client
│   ├── auth.ts                # NextAuth config
│   ├── prisma.ts              # Prisma client
│   └── inngest.ts             # Inngest client
├── services/
│   ├── recovery.ts            # Recovery case lifecycle
│   ├── retry.ts               # Retry scheduling + execution
│   ├── dunning-email.ts       # Email sequence management
│   ├── payment-update.ts      # Token generation + validation
│   ├── dashboard.ts           # Metrics aggregation
│   └── billing.ts             # Subscription tier management
├── types/
│   ├── decline-codes.ts
│   ├── recovery.ts
│   └── stripe.ts
└── constants/
    ├── decline-codes.ts       # Soft/hard classification
    ├── retry-config.ts        # Timing windows, max attempts
    └── pricing-tiers.ts       # Plan limits + features

tests/
├── unit/
│   ├── services/
│   └── constants/
├── integration/
│   ├── webhooks/
│   ├── recovery/
│   └── dashboard/
└── __mocks__/
    └── stripe.ts
```

**Structure Decision**: Single Next.js application using App Router with
route groups for auth and dashboard sections. Services layer contains
business logic. Inngest functions handle async job scheduling. This is a
standard Next.js web app — no backend/frontend split needed.

## Complexity Tracking

> No constitution violations detected. All decisions justified above.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Inngest dependency | Dynamic per-customer job scheduling with precise timing | Vercel Cron lacks dynamic scheduling; pg_cron lacks observability |
| React Email dependency | Customizable branded email templates with React components | Plain HTML templates are harder to maintain and test |
