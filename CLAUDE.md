# Project: DunnMaster

## Stack

- **Framework:** Next.js + TypeScript
- **Database:** Prisma (PostgreSQL)
- **Styling:** Tailwind CSS + shadcn/ui
- **State Management:** Zustand (frontend)
- **Auth:** NextAuth (user registration, access control)
- **Payments:** Stripe
- **Emails:** Resend
- **Testing:** Jest + React Testing Library

## Integraciones críticas
- Stripe Connect (OAuth para conectar cuentas)
- Stripe Webhooks (invoice.payment_failed, etc.)
- Stripe API (crear reintentos, obtener info de suscripción)

## Infrastructure

- **Deploy:** Vercel
- **Database Hosting:** Supabase

## Bash Command Rules

When using bash commands, always limit output:
- `grep`: pipe to `| head -20`
- `find`: use `-maxdepth 2`
- `ls`: pipe to `| head -30`
- Never display more than 30 lines of command output

## Testing Rules

- **Always verify tests pass during implementation.** After editing source or test files, check the PostToolUse hook output for test failures. If tests fail, stop and fix them before continuing.
- When writing new code that has corresponding tests, run the relevant test suite and confirm green before moving on.
- Integration tests that import Next.js API routes need `/** @jest-environment node */` docblock.
- In jest.mock factories, never reference `const` variables directly — use arrow function wrappers to avoid SWC hoisting TDZ errors (e.g., `findUnique: (...args: unknown[]) => mockFn(...args)`).

## Code Style

- **Modules:** ES Modules (`import`/`export`), not CommonJS
- **ES6+:** Arrow functions, destructuring, template literals, etc.
- **Indentation:** 2 spaces
- **Strings:** Single quotes
- **Semicolons:** None (Prettier handles it) — except where required in TypeScript (`enum`, `interface`)
- **Naming:**
  - `camelCase` for variables and functions
  - `PascalCase` for React components and classes
  - `UPPER_SNAKE_CASE` for constants
- **Components:** Functional components with hooks (no class components)
- **APIs:** Never use deprecated APIs

## Active Technologies
- TypeScript 5.x (strict mode) + Next.js 14+ (App Router), Prisma, Stripe SDK, (001-dunning-mvp)
- PostgreSQL (Supabase) (001-dunning-mvp)

## Recent Changes
- 001-dunning-mvp: Added TypeScript 5.x (strict mode) + Next.js 14+ (App Router), Prisma, Stripe SDK,
