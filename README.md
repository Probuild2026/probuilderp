Probuild ERP (single-tenant for now) built with Next.js App Router, Prisma, PostgreSQL, NextAuth, Tailwind, and shadcn/ui.

## Getting Started

### 1) Start Postgres (Docker)

```bash
docker compose up -d
```

### 2) Configure env

Copy `.env.example` to `.env` and adjust as needed.

### 3) Run migrations + seed

```bash
npm run prisma:migrate
npm run db:seed
```

If you want a local admin user (Credentials login), set these in `.env` before seeding:

- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`
- `SEED_ADMIN_NAME`

### 4) Run the dev server

```bash
npm run dev
```

Open `http://localhost:3000`.

## Auth

- Credentials login works only for seeded users (`passwordHash`).
- Google login requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `NEXT_PUBLIC_ENABLE_GOOGLE=1`.

## Notes

- The schema includes `tenantId` on all business tables with a default of `1`. Moving to multi-tenant later is intended to be a data migration + scoping pass, not a rewrite.
