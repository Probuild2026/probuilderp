# AGENTS.md

Repository guide for contributors and coding agents working in `probuild-erp`.

## Project Overview

- Stack: Next.js App Router, React 19, TypeScript, Prisma, PostgreSQL, NextAuth, Tailwind CSS, shadcn/ui.
- Runtime shape: server-first Next.js app with selective client components for forms and interactive UI.
- Domain: construction ERP covering projects, bills, payments made, expenses, wages, invoices, receipts, inventory, partners, and reports.

## Folder Structure

Top-level layout:

- `src/app`
  Next.js routes, layouts, server actions, and API routes.
- `src/app/app`
  Authenticated app UI pages grouped by module such as `projects`, `purchases`, `sales`, `expenses`, `wages`, `reports`, and `settings`.
- `src/app/actions`
  Shared server actions used across routes and pages.
- `src/app/api`
  Route handlers for exports, uploads, search, reports, and other server endpoints.
- `src/components`
  Reusable React components.
- `src/components/app`
  App-specific UI such as headers, sidebar, filters, and report widgets.
- `src/components/ui`
  Shared UI primitives based on shadcn/ui and Radix.
- `src/lib`
  Client/server-safe utilities, formatting helpers, validators, export helpers, and filter helpers.
- `src/lib/validators`
  Zod schemas for forms and server inputs.
- `src/server`
  Server-only code such as auth, Prisma access, domain helpers, report builders, and export builders.
- `src/server/domain`
  Accounting/tax domain logic such as GST and TDS rules.
- `src/server/exports`
  Shared dataset builders for file exports.
- `src/server/reports`
  Report computation logic that feeds UI and exports.
- `src/types`
  Shared type declarations such as NextAuth typing.
- `prisma`
  Prisma schema, migrations, and seed script.
- `scripts`
  Project maintenance scripts like finance tests, admin updates, icon generation, and clean-build helpers.
- `docs`
  Product and implementation documentation.
- `public`
  Static assets and icons.

## Commands

Install dependencies:

```bash
npm install
```

Local development:

```bash
docker compose up -d
npm run prisma:migrate
npm run db:seed
npm run dev
```

Build and production check:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

Type-check:

```bash
npx tsc --noEmit
```

Prisma utilities:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio
```

Project scripts:

```bash
npm run test:finance
npm run admin:update
npm run pwa:icons
```

## Code Style Rules

General:

- Use TypeScript in `strict` mode compatible with the current `tsconfig.json`.
- Prefer the `@/*` path alias over deep relative imports.
- Keep server-only logic in `src/server`, route handlers, or server actions. Do not leak Prisma or auth logic into client components.
- Default to server components. Add `"use client"` only when state, browser APIs, or client-only hooks are required.
- Reuse existing helpers and UI primitives before adding new abstractions.

React / Next.js:

- Follow App Router conventions already used in the repo.
- Keep list pages and reports server-rendered where possible.
- Use client components mainly for dialogs, forms, transitions, and interactive controls.
- Preserve mobile usability. Many pages are data-heavy, so new UI should work on narrow screens without depending on wide tables only.

Forms and validation:

- Use Zod schemas for input validation.
- Keep shared schemas in `src/lib/validators` when they are reused across UI and server.
- Validate again on the server even when the client already validates.
- Surface actionable validation messages; avoid generic failure-only toasts when field-level errors are available.

Database / Prisma:

- Update `prisma/schema.prisma` first for data model changes, then generate/apply migrations.
- Be careful with `Prisma.Decimal`; do not silently mix money math with raw floating-point assumptions.
- Scope queries by `tenantId` consistently.
- Keep project-scoped filters and date filters consistent with existing module behavior.

Reports and exports:

- Build report logic in `src/server/reports`.
- Build reusable export datasets in `src/server/exports`.
- Prefer shared export plumbing over one-off CSV logic when a module supports multiple formats.
- Keep exported columns aligned with what users see in the corresponding page.

UI conventions:

- Use existing components from `src/components/ui` and `src/components/app`.
- Follow the existing visual language; do not introduce a disconnected design system.
- Prefer concise, operational copy aimed at accountants, site staff, and business owners.
- On mobile, prefer compact summaries, cards, and progressive disclosure instead of forcing horizontal scrolling.

Files and naming:

- Keep module pages under their route folders in `src/app/app/...`.
- Put route-specific helper components close to the route when they are not reused elsewhere.
- Use clear names based on the business object or report being implemented.

## Working Rules

- Before major changes, check for existing helpers in `src/lib`, `src/server`, and nearby module code.
- For new reports, add both UI and export support when practical.
- For new finance features, think in terms of source-of-truth tables and accounting meaning before adding UI.
- Prefer incremental, verifiable changes over broad rewrites.

## Minimum Verification Before Finishing

For most code changes, run:

```bash
npm run lint
npx tsc --noEmit
```

Also run these when relevant:

- `npm run build` for routing, server, or dependency changes.
- `npm run test:finance` when touching finance calculations or report logic.
