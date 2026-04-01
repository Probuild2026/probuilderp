# Product Roadmap

This roadmap is grounded in the current product surface under `src/app/app` and focuses on closing the biggest workflow and reporting gaps before expanding sideways.

## Phase 1: Finance Visibility and Close Controls

Goal: give the business owner and accountant a daily command center for collections, payables, tax, and period close.

Milestone 1: Aging and ledger reports

- Ticket: Receivables aging report by client and project
  Acceptance: due-date buckets, outstanding totals, project filter, export to CSV/Excel/PDF.
- Ticket: Payables aging report by vendor and project
  Acceptance: bill-date buckets until vendor due date is added, export support, mobile readable summary cards.
- Ticket: Vendor ledger
  Acceptance: bill booked, payment made, running balance, project scope filter.
- Ticket: Client ledger
  Acceptance: invoice booked, receipt received, TDS deducted, running balance.

Milestone 2: Tax and compliance reports

- Ticket: GST purchase register
  Acceptance: monthly summary and row-level drilldown by bill/expense.
- Ticket: GST sales register
  Acceptance: invoice totals, GST split, receipt linkage.
- Ticket: TDS dashboard
  Acceptance: deducted vs payable vs paid, split by 194C and 194T, FY filter.

Milestone 3: Controls and close

- Ticket: Month lock / period lock
  Acceptance: closed periods cannot be edited without admin override.
- Ticket: Approval statuses for bills, payments, expenses, wages, receipts
  Acceptance: draft, pending approval, approved, cancelled.
- Ticket: Audit trail
  Acceptance: create/edit/delete/export events with user, timestamp, module, and changed fields summary.

## Phase 2: Mobile-First Operations

Goal: make field usage fast and reliable from phones, not just compressed desktop tables.

Milestone 1: List-page mobile redesign

- Ticket: Card view for bills, payments made, expenses, wages, receipts, invoices, transactions
  Acceptance: primary facts visible in one viewport, expandable secondary details.
- Ticket: Filter sheet
  Acceptance: mobile filter panel with applied-filter summary chips.
- Ticket: Sticky quick actions
  Acceptance: one-tap add bill, payment, expense, wage, receipt from mobile.

Milestone 2: Capture workflow

- Ticket: Camera-first attachment flow
  Acceptance: upload from phone camera into bills and expenses with preview.
- Ticket: Draft autosave on long forms
  Acceptance: bill, invoice, expense, wage, and payment forms recover after interruption.
- Ticket: Field shortcuts
  Acceptance: call vendor, WhatsApp share, copy UPI/account, map project address.

## Phase 3: Procurement and Job Cost Control

Goal: move from transaction logging to actual project control.

Milestone 1: Commitment management

- Ticket: Vendor quotations
  Acceptance: compare vendor rates and choose winner.
- Ticket: Purchase orders / subcontracts
  Acceptance: approval, status, linked project, linked vendor, linked bills.
- Ticket: Change orders
  Acceptance: increase/decrease committed cost and preserve history.

Milestone 2: Budget vs actual

- Ticket: Project budget by cost head
  Acceptance: original budget, revised budget, committed, actual, paid, variance.
- Ticket: Cost code structure
  Acceptance: shared cost heads across bills, expenses, wages, and transactions.
- Ticket: Project profitability report
  Acceptance: billed, received, committed, spent, paid, margin by project.

## Phase 4: Operational Automation and Hardening

Goal: make the system safer and reduce manual follow-up.

Milestone 1: Exceptions and reminders

- Ticket: Overdue collections dashboard
  Acceptance: aging alerts and reminder queue.
- Ticket: Upcoming payments dashboard
  Acceptance: due bills, cash requirement forecast, TDS payable.
- Ticket: Data quality exceptions
  Acceptance: missing GSTIN/PAN, missing attachments, unallocated payments, duplicate-looking entries.

Milestone 2: Reliability

- Ticket: Idempotency on create flows
  Acceptance: duplicate form submits do not create duplicate records.
- Ticket: Import duplicate detection
  Acceptance: import preview flags likely existing bills/payments/receipts.
- Ticket: Integration health page
  Acceptance: DB, blob storage, auth, and migration state visible to admins.

## Recommended Build Order

1. Aging reports, ledgers, GST/TDS summary.
2. Approval status + audit trail + month lock.
3. Mobile list redesign and filter sheet.
4. Budget / commitments / profitability.
5. Automation, exceptions, and reliability hardening.

## Phase 1 Start

Started in this branch:

- Receivables aging report
- Payables aging report
- Reports dashboard links for both

Next immediate tickets after that:

1. Vendor ledger
2. Client ledger
3. GST purchase register
4. GST sales register
5. TDS dashboard
