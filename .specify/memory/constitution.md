<!--
=== Sync Impact Report ===
Version change: 0.0.0 → 1.0.0 (MAJOR — initial ratification)
Modified principles: N/A (all new)
Added sections:
  - Core Principles (5 principles)
  - Security Requirements
  - Performance Standards
  - Governance
Removed sections: N/A
Templates requiring updates:
  - .specify/templates/plan-template.md — ✅ compatible (Constitution Check section present)
  - .specify/templates/spec-template.md — ✅ compatible (requirements/success criteria align)
  - .specify/templates/tasks-template.md — ✅ compatible (phase structure supports all principles)
  - .specify/templates/commands/*.md — ✅ no command files exist yet
Follow-up TODOs: None
===========================
-->

# Dunn Master Constitution

## Core Principles

### I. Type Safety

All code MUST be written in TypeScript with strict mode enabled.
Implicit `any` is forbidden. Shared interfaces and types MUST be
defined in dedicated type files and imported explicitly. Prisma-
generated types MUST be used for all database interactions — manual
type duplication of schema entities is prohibited.

**Rationale**: Dunn Master integrates Stripe, NextAuth, and Prisma
across API routes, webhooks, and frontend components. Type safety
catches integration mismatches at compile time rather than in
production.

### II. Test Discipline

Every feature MUST include tests that cover its acceptance criteria
before the pull request is merged. Unit tests (Jest) MUST cover
business logic in services and utilities. Integration tests (React
Testing Library) MUST cover user-facing flows. Stripe webhook
handlers and payment flows MUST have dedicated test coverage using
mocked Stripe events.

**Rationale**: Payment and auth logic carry financial and security
risk. Untested payment paths can silently fail, leading to lost
revenue or broken user experiences.

### III. Security-First

All user input MUST be validated and sanitized at the API boundary.
Authentication (NextAuth) MUST protect every non-public route and
API endpoint. Stripe webhook endpoints MUST verify signatures before
processing events. Secrets (API keys, database URLs, Stripe keys)
MUST NOT appear in client bundles or version control — environment
variables only. CSRF protection MUST be active on all state-changing
endpoints.

**Rationale**: The application handles user credentials, payment
data, and Stripe Connect OAuth tokens. A single security lapse can
expose financial data or enable unauthorized charges.

### IV. API Contract Stability

All API routes MUST follow RESTful conventions with consistent
response shapes. Breaking changes to API contracts MUST be versioned
or gated behind feature flags. Stripe webhook handlers MUST be
idempotent — processing the same event twice MUST produce the same
result. Error responses MUST use structured JSON with consistent
status codes and error message formats.

**Rationale**: Stripe sends webhooks with at-least-once delivery.
Frontend components depend on stable API shapes. Contract drift
between frontend and backend causes silent failures that are hard
to diagnose.

### V. Simplicity

Prefer the simplest solution that satisfies requirements. New
dependencies MUST be justified — no library additions without a
concrete problem they solve. Abstractions MUST NOT be introduced
for hypothetical future needs (YAGNI). Components MUST have a single
responsibility. Server Components MUST be the default; Client
Components are used only when interactivity requires them.

**Rationale**: Dunn Master's stack (Next.js, Prisma, Stripe,
NextAuth, Zustand) already carries significant complexity. Every
unnecessary abstraction compounds cognitive load and maintenance
burden.

## Security Requirements

- All Stripe API calls MUST use the server-side secret key, never
  the publishable key, for sensitive operations.
- Stripe Connect OAuth tokens MUST be stored encrypted at rest in
  the database.
- NextAuth session tokens MUST use secure, httpOnly cookies with
  SameSite=Lax or Strict.
- Database queries MUST use Prisma's parameterized queries — raw SQL
  is prohibited unless explicitly justified and reviewed.
- All third-party redirect URLs (Stripe Connect, OAuth) MUST be
  validated against an allowlist.
- Resend email templates MUST NOT include user-controlled content
  without sanitization to prevent email injection.
- Content Security Policy headers MUST be configured to prevent XSS.

## Performance Standards

- API route responses MUST complete within 500ms at p95 under normal
  load (excluding external API calls to Stripe).
- Stripe webhook processing MUST acknowledge (return 200) within
  5 seconds; long-running operations MUST be queued.
- Client-side JavaScript bundle MUST stay under 200KB gzipped for
  initial page load.
- Largest Contentful Paint (LCP) MUST be under 2.5 seconds on
  production pages.
- Database queries MUST NOT trigger N+1 patterns — use Prisma
  `include` or `select` for related data.
- Images MUST use Next.js `<Image>` component with appropriate
  sizing and lazy loading.

## Governance

This constitution is the highest-authority document for development
decisions in Dunn Master. All pull requests MUST be verified against
these principles before merge. Conflicts between convenience and a
constitutional principle MUST be resolved in favor of the principle.

### Amendment Procedure

1. Propose the change in a dedicated pull request modifying this file.
2. The PR description MUST state which principles are affected and
   the rationale for the change.
3. Version bump MUST follow semantic versioning:
   - MAJOR: Principle removal or backward-incompatible redefinition.
   - MINOR: New principle or materially expanded guidance.
   - PATCH: Clarifications, typos, non-semantic refinements.
4. After merge, dependent templates MUST be reviewed for consistency
   (see Sync Impact Report at the top of this file).

### Compliance Review

Every feature spec and implementation plan MUST include a
"Constitution Check" section verifying alignment with all five
core principles. Violations MUST be documented with justification
in the plan's Complexity Tracking table.

**Version**: 1.0.0 | **Ratified**: 2026-04-05 | **Last Amended**: 2026-04-05
