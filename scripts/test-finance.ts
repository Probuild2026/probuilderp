import assert from "node:assert/strict";

import { Prisma } from "@prisma/client";

import {
  calcExpenseBalance,
  calcExpensePaidAmount,
  calcExpenseStatus,
  calcInvoiceBalance,
  calcInvoicePaidAmount,
  calcInvoiceStatus,
  calcProjectSummary,
} from "../src/lib/finance";

function d(n: number | string) {
  return new Prisma.Decimal(n);
}

const today = new Date("2026-02-28T00:00:00.000Z");

// Invoice: total 118000, paid 47000 + TDS 3000 = 50000 => balance 68000
{
  const invoice = { total: d(118000), dueDate: new Date("2026-02-15T00:00:00.000Z"), status: "ISSUED" };
  const allocations = [{ cashAmount: d(47000), tdsAmount: d(3000) }];

  assert.equal(calcInvoicePaidAmount(invoice, allocations).toString(), "50000");
  assert.equal(calcInvoiceBalance(invoice, allocations).toString(), "68000");
  assert.equal(calcInvoiceStatus(invoice, allocations, today), "PartiallyPaid");
}

// Invoice overdue when unpaid and past due date
{
  const invoice = { total: d(1000), dueDate: new Date("2026-02-01T00:00:00.000Z"), status: "ISSUED" };
  assert.equal(calcInvoiceStatus(invoice, [], today), "Overdue");
}

// Draft stays Draft regardless
{
  const invoice = { total: d(1000), dueDate: null, status: "DRAFT" };
  assert.equal(calcInvoiceStatus(invoice, [{ cashAmount: d(1000) }], today), "Draft");
}

// Expense: total 59000, paid 20000 + TDS 500 => settled 20500 => balance 38500
{
  const expense = { total: d(59000), dueDate: new Date("2026-02-20T00:00:00.000Z") };
  const allocations = [{ cashAmount: d(20000), tdsAmount: d(500) }];

  assert.equal(calcExpensePaidAmount(expense, allocations).toString(), "20500");
  assert.equal(calcExpenseBalance(expense, allocations).toString(), "38500");
  assert.equal(calcExpenseStatus(expense, allocations, today), "PartiallyPaid");
}

// Project summary: basic sanity checks
{
  const project = { id: "p1" };
  const invoices = [{ id: "i1", subtotal: d(100000), total: d(118000) }];
  const expenses = [{ id: "e1", subtotal: d(50000), total: d(59000) }];
  const transactions = [
    { projectId: "p1", direction: "IN" as const, amount: d(47000), tdsAmount: d(3000) },
    { projectId: "p1", direction: "OUT" as const, amount: d(20000), tdsAmount: d(500) },
  ];
  const allocations = [
    { invoiceId: "i1", cashAmount: d(47000), tdsAmount: d(3000) },
    { expenseId: "e1", cashAmount: d(20000), tdsAmount: d(500) },
  ];

  const s = calcProjectSummary(project, invoices, expenses, transactions, allocations);
  assert.equal(s.invoicesPaid.toString(), "50000");
  assert.equal(s.expensesPaid.toString(), "20500");
  assert.equal(s.netCash.toString(), "27000");
  assert.equal(s.netTds.toString(), "2500");
}

console.log("finance: ok");

