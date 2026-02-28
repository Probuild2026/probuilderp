/*
  NOTE (2026-02-28):
  This migration attempted a large “durable backbone” refactor (dropping/replacing
  core tables like ClientInvoice/Receipt/TransactionAllocation and rewriting Expense).

  The production app currently relies on the pre-refactor schema. Applying this
  migration in production is destructive and has already caused deploy-time
  failures (e.g. NOT NULL constraints against existing data).

  We keep this migration as an intentional NO-OP to preserve the linear Prisma
  migration history while keeping production stable.
*/

SELECT 1;
