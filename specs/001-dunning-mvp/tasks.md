# Tasks: Failed Payment Recovery (Dunning) MVP

**Input**: Design documents from `/specs/001-dunning-mvp/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Tests are included per user story to validate acceptance criteria.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single Next.js app**: `src/app/` for routes, `src/components/` for UI, `src/services/` for logic, `src/lib/` for clients

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Initialize Next.js project, install dependencies, configure tooling

- [x] T001 Initialize Next.js project with TypeScript strict mode, App Router, Tailwind CSS, and ESLint in `src/`
- [x] T002 [P] Install and configure Prisma with PostgreSQL connection in `prisma/schema.prisma`
- [x] T003 [P] Install project dependencies: `stripe`, `next-auth`, `resend`, `inngest`, `zustand`, `react-email`, `@react-email/components`, `jose` (JWT)
- [x] T004 [P] Initialize shadcn/ui and add base components (Button, Card, Input, Badge, Table) in `src/components/ui/`
- [x] T005 [P] Configure ESLint with `@typescript-eslint/no-explicit-any` rule in `.eslintrc.json`
- [x] T006 [P] Create `.env.example` with all required environment variables per `specs/001-dunning-mvp/quickstart.md`
- [x] T007 [P] Configure Jest and React Testing Library in `jest.config.ts` and `jest.setup.ts`

**Checkpoint**: Project builds, lints, and runs `npm run dev` successfully

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can begin

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T008 Define Prisma schema with all enums (`DeclineType`, `RecoveryCaseStatus`, `RecoveryPhase`, `RetryStatus`, `EmailTemplateType`, `EmailStatus`, `SessionStatus`, `PlanTier`, `PlanStatus`) and models (`User`, `Account`, `Session`, `Business`, `BrandingSettings`, `SubscriptionPlan`, `RecoveryCase`, `RetryAttempt`, `DunningEmail`, `PaymentUpdateSession`, `WebhookEvent`) with indexes per `specs/001-dunning-mvp/data-model.md` in `prisma/schema.prisma`
- [x] T009 Run `prisma generate` and `prisma db push` to create database schema and generate types
- [x] T010 [P] Create Prisma client singleton in `src/lib/prisma.ts`
- [x] T011 [P] Create Stripe client with pinned API version in `src/lib/stripe.ts`
- [x] T012 [P] Configure NextAuth with email/password provider and session strategy in `src/lib/auth.ts` and `src/app/api/auth/[...nextauth]/route.ts`
- [x] T013 [P] Create Resend client in `src/lib/resend.ts`
- [x] T014 [P] Create Inngest client in `src/lib/inngest.ts` and serve route in `src/app/api/inngest/route.ts`
- [x] T015 [P] Define decline code constants (SOFT_DECLINE_CODES, HARD_DECLINE_CODES sets) in `src/constants/decline-codes.ts`
- [x] T016 [P] Define retry configuration constants (intervals, optimal hours, max attempts) in `src/constants/retry-config.ts`
- [x] T017 [P] Define pricing tier constants (limits, features per tier) in `src/constants/pricing-tiers.ts`
- [x] T018 [P] Create shared TypeScript types for domain objects in `src/types/recovery.ts`, `src/types/decline-codes.ts`, and `src/types/stripe.ts`
- [x] T019 [P] Create API response envelope helpers (`successResponse`, `errorResponse`) in `src/lib/api-response.ts`
- [x] T020 [P] Create auth middleware helper to extract business from session in `src/lib/auth-middleware.ts`
- [x] T021 [P] Create Stripe mock utilities for testing in `tests/__mocks__/stripe.ts`
- [x] T022 [P] Build login page in `src/app/(auth)/login/page.tsx`
- [x] T023 [P] Build registration page in `src/app/(auth)/register/page.tsx`
- [x] T024 Configure CSP headers and security middleware in `next.config.ts`

**Checkpoint**: Foundation ready — auth works, database connected, all clients initialized, user can register and log in

---

## Phase 3: User Story 1 — Connect Stripe and Activate Recovery (Priority: P1) MVP

**Goal**: Business owner connects Stripe account via OAuth and system begins monitoring for failed payments

**Independent Test**: Register, complete Stripe Connect OAuth, verify monitoring active and webhook events are captured

### Tests for User Story 1

- [x] T025 [P] [US1] Write integration test for Stripe Connect OAuth flow (redirect + callback) in `tests/integration/webhooks/stripe-connect.test.ts`
- [x] T026 [P] [US1] Write integration test for webhook signature verification and event routing in `tests/integration/webhooks/webhook-handler.test.ts`
- [x] T027 [P] [US1] Write unit test for webhook idempotency (duplicate event rejection) in `tests/unit/services/webhook-idempotency.test.ts`

### Implementation for User Story 1

- [x] T028 [US1] Implement Stripe Connect OAuth redirect route (generate auth URL with state param) in `src/app/api/stripe/connect/route.ts`
- [x] T029 [US1] Implement Stripe Connect OAuth callback route (exchange code, store tokens, create Business + BrandingSettings + SubscriptionPlan records, set monitoringActive=true) in `src/app/api/stripe/connect/callback/route.ts`
- [x] T030 [US1] Implement Stripe disconnect route (revoke access, pause active recovery cases) in `src/app/api/stripe/connect/route.ts` (DELETE handler)
- [x] T031 [US1] Implement webhook endpoint with signature verification, idempotency check via WebhookEvent table, and event routing to handlers in `src/app/api/stripe/webhooks/route.ts`
- [x] T032 [US1] Implement recovery case creation service: classify decline code, create RecoveryCase record, dispatch Inngest event in `src/services/recovery.ts`
- [x] T033 [US1] Implement recovery case closure service: mark as recovered, cancel pending retries and emails on `invoice.payment_succeeded` in `src/services/recovery.ts`
- [x] T034 [US1] Implement recovery case cancellation on `customer.subscription.updated` (when status=canceled) in `src/services/recovery.ts`
- [x] T035 [US1] Build Stripe Connect settings page with connect/disconnect buttons and status display in `src/app/(dashboard)/settings/stripe/page.tsx`
- [x] T036 [US1] Build Stripe Connect button component in `src/components/settings/stripe-connect-button.tsx`

**Checkpoint**: User can register, connect Stripe, and the system creates recovery cases from webhook events

---

## Phase 4: User Story 2 — Smart Retry of Failed Payments (Priority: P1)

**Goal**: System automatically retries soft-decline payments at optimal times based on timezone and decline type

**Independent Test**: Trigger `invoice.payment_failed` with soft decline, verify 3 retries scheduled at correct timezone-aware times; trigger with hard decline, verify retries skipped

### Tests for User Story 2

- [x] T037 [P] [US2] Write unit test for decline code classification (soft vs hard) in `tests/unit/constants/decline-codes.test.ts`
- [x] T038 [P] [US2] Write unit test for retry scheduling logic (timezone conversion, optimal window targeting, interval calculation) in `tests/unit/services/retry-scheduling.test.ts`
- [x] T039 [P] [US2] Write integration test for Inngest payment-retry function (step execution, Stripe API call, state transitions) in `tests/integration/recovery/payment-retry.test.ts`

### Implementation for User Story 2

- [x] T040 [US2] Implement retry scheduling service: compute next retry timestamp based on decline type, customer timezone, optimal windows (Tue-Thu 7AM local), and retry interval (3/5/7 days) in `src/services/retry.ts`
- [x] T041 [US2] Implement Inngest `payment-retry` function: receive `dunning/payment.failed` event, loop through retry attempts with `step.sleepUntil()`, call `stripe.invoices.pay()`, update RetryAttempt records, escalate to email phase on exhaustion in `src/inngest/payment-retry.ts`
- [x] T042 [US2] Implement Inngest `recovery-case-timeout` function: sleep 14 days, mark unrecovered cases as FAILED in `src/inngest/recovery-timeout.ts`
- [x] T043 [US2] Update recovery creation service (T032) to dispatch `dunning/payment.failed` Inngest event with businessId, recoveryCaseId, declineType, customerTimezone in `src/services/recovery.ts`

**Checkpoint**: Soft declines trigger timezone-aware retries via Inngest; hard declines skip retries; successful retries close recovery cases

---

## Phase 5: User Story 3 — Dunning Email Sequence (Priority: P1)

**Goal**: System sends 3 escalating emails at day 1/4/7 with customizable branding, cancels on recovery

**Independent Test**: Trigger email phase for a recovery case, verify 3 emails scheduled with correct `scheduledAt` offsets via Resend; simulate recovery, verify pending emails cancelled

### Tests for User Story 3

- [x] T044 [P] [US3] Write unit test for email scheduling logic (day offsets, subject lines, template selection) in `tests/unit/services/dunning-email.test.ts`
- [x] T045 [P] [US3] Write unit test for email cancellation on recovery in `tests/unit/services/email-cancellation.test.ts`
- [x] T046 [P] [US3] Write snapshot test for React Email dunning template rendering (all 3 variants) in `tests/unit/emails/dunning-email.test.tsx`

### Implementation for User Story 3

- [x] T047 [P] [US3] Create React Email dunning template with props for `companyName`, `logoUrl`, `brandColor`, `customerName`, `updatePaymentUrl`, `step` (1/2/3) in `src/emails/dunning-email.tsx`
- [x] T048 [P] [US3] Create shared email components (Header with logo, CTA Button, Footer) in `src/emails/components/`
- [x] T049 [US3] Implement dunning email service: schedule all 3 emails via Resend `scheduledAt`, store `resendEmailId` in DunningEmail records, generate payment update URLs in `src/services/dunning-email.ts`
- [x] T050 [US3] Implement email cancellation: on recovery, find all SCHEDULED DunningEmail records, call `resend.emails.cancel(emailId)`, update status to CANCELLED in `src/services/dunning-email.ts`
- [x] T051 [US3] Wire email phase trigger: when retry phase exhausts (or hard decline), call dunning email service from recovery service in `src/services/recovery.ts`
- [x] T052 [US3] Build branding settings page with form for companyName, logo upload, primaryColor, accentColor, supportEmail in `src/app/(dashboard)/settings/branding/page.tsx`
- [x] T053 [US3] Implement branding settings API routes (GET/PUT) in `src/app/api/settings/branding/route.ts`

**Checkpoint**: Emails are scheduled via Resend on dunning phase entry, cancelled on recovery, and render with business branding

---

## Phase 6: User Story 4 — Hosted Payment Update Page (Priority: P2)

**Goal**: Customers receive a secure link to update their payment method without logging in

**Independent Test**: Generate a payment update token, visit the page, submit new card details via Stripe Elements, verify payment method updated and retry triggered

### Tests for User Story 4

- [x] T054 [P] [US4] Write unit test for token generation (JWT signing, expiration) and validation (expired, used, invalid) in `tests/unit/services/payment-update.test.ts`
- [x] T055 [P] [US4] Write integration test for payment update flow (token validation → SetupIntent → confirm → retry) in `tests/integration/recovery/payment-update.test.ts`

### Implementation for User Story 4

- [x] T056 [US4] Implement payment update token service: generate signed JWT with recoveryCaseId and expiration (48h), create PaymentUpdateSession record, validate tokens (check expiry + used status) in `src/services/payment-update.ts`
- [x] T057 [US4] Implement GET `/api/payment-update/[token]` route: validate token, create Stripe SetupIntent, return clientSecret + branding info in `src/app/api/payment-update/[token]/route.ts`
- [x] T058 [US4] Implement POST `/api/payment-update/[token]/confirm` route: verify SetupIntent succeeded, update customer default payment method in Stripe, mark session as USED, trigger immediate retry in `src/app/api/payment-update/[token]/confirm/route.ts`
- [x] T059 [US4] Build payment update page (public, no auth): load branding from API, render Stripe PaymentElement, handle submission and success/error states in `src/app/update-payment/[token]/page.tsx`
- [x] T060 [US4] Build PaymentForm client component with Stripe Elements (Elements provider, PaymentElement, submit button) in `src/components/recovery/payment-form.tsx`
- [x] T061 [US4] Wire payment update URL generation into dunning email service (T049): generate token and include URL in each email's `updatePaymentUrl` prop in `src/services/dunning-email.ts`

**Checkpoint**: Dunning emails contain working payment update links; customers can update cards without login; successful updates trigger immediate retry

---

## Phase 7: User Story 5 — Recovery Dashboard (Priority: P2)

**Goal**: Business owners see MRR at risk, MRR recovered, recovery rate, and active pending payments

**Independent Test**: Create recovery cases in various states, verify dashboard displays accurate aggregated metrics and case list

### Tests for User Story 5

- [x] T062 [P] [US5] Write unit test for dashboard metrics aggregation (MRR calculations, recovery rate, currency handling) in `tests/unit/services/dashboard.test.ts`
- [x] T063 [P] [US5] Write integration test for dashboard metrics API route in `tests/integration/dashboard/metrics.test.ts`

### Implementation for User Story 5

- [x] T064 [US5] Implement dashboard metrics service: aggregate MRR at risk (sum of PENDING/RETRYING/EMAILING case amounts), MRR recovered this month, recovery rate, active case count in `src/services/dashboard.ts`
- [x] T065 [US5] Implement GET `/api/dashboard/metrics` route returning aggregated metrics in `src/app/api/dashboard/metrics/route.ts`
- [x] T066 [US5] Implement GET `/api/recovery` route with pagination and status filtering per API contract in `src/app/api/recovery/route.ts`
- [x] T067 [US5] Implement GET `/api/recovery/[id]` route returning case detail with retry attempts and emails in `src/app/api/recovery/[id]/route.ts`
- [x] T068 [US5] Create Zustand store for dashboard state (metrics, case list, filters, loading) in `src/stores/dashboard-store.ts`
- [x] T069 [US5] Build dashboard page with metric cards (MRR at risk, MRR recovered, recovery rate, active cases) in `src/app/(dashboard)/dashboard/page.tsx`
- [x] T070 [P] [US5] Build MetricCard component in `src/components/dashboard/metric-card.tsx`
- [x] T071 [P] [US5] Build RecoveryCaseTable component with status badges, amounts, and next action in `src/components/dashboard/recovery-case-table.tsx`
- [x] T072 [US5] Build recovery case detail page showing timeline of retries and emails in `src/app/(dashboard)/recovery/[id]/page.tsx`
- [x] T073 [US5] Build empty state component for new users with no recovery cases in `src/components/dashboard/empty-state.tsx`

**Checkpoint**: Dashboard shows accurate live metrics; case list is filterable and paginated; detail view shows full recovery timeline

---

## Phase 8: User Story 6 — Subscription Plan and Billing (Priority: P3)

**Goal**: Three pricing tiers with enforced limits and upgrade/downgrade flow

**Independent Test**: Subscribe to Starter, exceed $10K MRR limit, verify upgrade prompt; change plan, verify prorated billing

### Tests for User Story 6

- [x] T074 [P] [US6] Write unit test for tier limit enforcement logic (MRR cap check, feature gating) in `tests/unit/services/billing.test.ts`
- [x] T075 [P] [US6] Write integration test for plan change flow (Stripe subscription update, proration) in `tests/integration/recovery/billing.test.ts`

### Implementation for User Story 6

- [x] T076 [US6] Implement billing service: check tier limits on new recovery case creation, calculate usage percentage, handle plan changes via Stripe Subscription API with proration in `src/services/billing.ts`
- [x] T077 [US6] Implement tier limit enforcement middleware: check `currentMrrMonitored` against `mrrLimit` before creating recovery cases, return upgrade prompt data when limit exceeded in `src/services/billing.ts`
- [x] T078 [US6] Implement GET `/api/billing` route returning current plan, usage, and period info in `src/app/api/billing/route.ts`
- [x] T079 [US6] Implement POST `/api/billing/change-plan` route: validate tier transition, update Stripe subscription, update SubscriptionPlan record in `src/app/api/billing/change-plan/route.ts`
- [x] T080 [US6] Build billing settings page showing current plan, usage bar, and plan comparison cards with upgrade/downgrade buttons in `src/app/(dashboard)/settings/billing/page.tsx`
- [x] T081 [P] [US6] Build PlanCard component displaying tier features, price, and limits in `src/components/settings/plan-card.tsx`
- [x] T082 [P] [US6] Build UsageBar component showing MRR monitored vs limit in `src/components/settings/usage-bar.tsx`
- [x] T083 [US6] Build upgrade prompt modal that appears when tier limit is approached (80%) or exceeded in `src/components/settings/upgrade-prompt.tsx`
- [x] T084 [US6] Wire tier limit check into recovery case creation (T032): before creating case, verify business has capacity, show upgrade prompt if not in `src/services/recovery.ts`

**Checkpoint**: All three tiers enforce their limits; users can change plans with prorated billing; upgrade prompts appear at thresholds

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T085 [P] Build dashboard layout shell with sidebar navigation (Dashboard, Recovery, Settings) in `src/app/(dashboard)/layout.tsx`
- [x] T086 [P] Build app-wide loading and error boundary components in `src/app/(dashboard)/loading.tsx` and `src/app/(dashboard)/error.tsx`
- [x] T087 [P] Add rate limiting to public routes (`/api/payment-update/`, `/api/stripe/webhooks/`) in `src/lib/rate-limit.ts`
- [x] T088 [P] Configure Vercel deployment settings (environment variables, Inngest integration, cron for cleanup) in `vercel.json`
- [x] T089 Run full test suite and fix any failures across all test files
- [x] T090 Run quickstart.md validation: follow all steps in `specs/001-dunning-mvp/quickstart.md` end-to-end to verify developer onboarding works

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — BLOCKS US2, US3 (need webhook + recovery service)
- **US2 (Phase 4)**: Depends on US1 (needs recovery case creation + Inngest events)
- **US3 (Phase 5)**: Depends on US1 (needs recovery service); can run in parallel with US2
- **US4 (Phase 6)**: Depends on US3 (payment update URLs embedded in emails)
- **US5 (Phase 7)**: Depends on US1 (needs recovery cases to display); can start after US1
- **US6 (Phase 8)**: Depends on US1 (enforces limits on case creation); can start after US1
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Foundation only — enables all other stories
- **US2 (P1)**: Requires US1 recovery case creation and Inngest dispatch
- **US3 (P1)**: Requires US1 recovery service; independent of US2 retry logic
- **US4 (P2)**: Requires US3 email service for URL embedding
- **US5 (P2)**: Requires US1 for data; independent of US2/US3/US4
- **US6 (P3)**: Requires US1 for enforcement point; independent of US2-US5

### Parallel Opportunities After Foundational

```text
                    ┌── US2 (Smart Retry) ──────┐
US1 (Connect) ─────┤                            ├── US4 (Payment Page)
                    ├── US3 (Email Sequence) ────┘
                    ├── US5 (Dashboard) ──── independent
                    └── US6 (Billing) ────── independent
```

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Models/constants before services
- Services before API routes
- API routes before UI pages
- Core implementation before integration points
- Story complete before moving to next priority

---

## Parallel Example: Phase 2 (Foundational)

```bash
# All these can run in parallel (different files, no dependencies):
Task T010: "Create Prisma client singleton in src/lib/prisma.ts"
Task T011: "Create Stripe client in src/lib/stripe.ts"
Task T012: "Configure NextAuth in src/lib/auth.ts"
Task T013: "Create Resend client in src/lib/resend.ts"
Task T014: "Create Inngest client in src/lib/inngest.ts"
Task T015: "Define decline code constants in src/constants/decline-codes.ts"
Task T016: "Define retry config in src/constants/retry-config.ts"
Task T017: "Define pricing tiers in src/constants/pricing-tiers.ts"
Task T018: "Create shared types in src/types/"
Task T019: "Create API response helpers in src/lib/api-response.ts"
Task T020: "Create auth middleware in src/lib/auth-middleware.ts"
Task T021: "Create Stripe mocks in tests/__mocks__/stripe.ts"
Task T022: "Build login page"
Task T023: "Build register page"
```

## Parallel Example: User Story 5 (Dashboard)

```bash
# After T064-T067 (services + API routes), these can run in parallel:
Task T070: "Build MetricCard component"
Task T071: "Build RecoveryCaseTable component"
Task T073: "Build empty state component"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (Connect + Webhooks)
4. **STOP and VALIDATE**: Test Stripe Connect flow end-to-end
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 (Connect) → Stripe connected, webhooks firing (MVP!)
3. US2 (Retry) → Automated payment recovery active
4. US3 (Emails) → Customer outreach working
5. US4 (Payment Page) → Frictionless card update flow
6. US5 (Dashboard) → Business visibility into recovery ROI
7. US6 (Billing) → Monetization with tier enforcement

### Parallel Team Strategy

With 2-3 developers after US1 completes:

1. Team completes Setup + Foundational + US1 together
2. Once US1 is done:
   - Developer A: US2 (Smart Retry) → US4 (Payment Page)
   - Developer B: US3 (Email Sequence) → US4 (Payment Page integration)
   - Developer C: US5 (Dashboard) + US6 (Billing)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All monetary amounts stored in cents to avoid floating-point issues
- Stripe Elements handles PCI compliance — never handle raw card numbers
