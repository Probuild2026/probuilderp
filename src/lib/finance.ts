import { Prisma } from "@prisma/client";

export type Money = Prisma.Decimal;
export type MoneyInput = Prisma.Decimal | number | string;

export type InvoiceLike = {
  total: MoneyInput;
  dueDate?: Date | null;
  status?: string | null;
};

export type ExpenseLike = {
  total: MoneyInput;
  dueDate?: Date | null;
};

export type AllocationLike = {
  cashAmount: MoneyInput;
  tdsAmount?: MoneyInput | null;
};

export type ProjectLike = { id: string };

export type TransactionLike = {
  projectId?: string | null;
  direction: "IN" | "OUT" | "TRANSFER";
  amount: MoneyInput;
  tdsAmount?: MoneyInput | null;
};

export type DocumentAllocationLike = AllocationLike & {
  invoiceId?: string | null;
  expenseId?: string | null;
};

function money(value: MoneyInput): Money {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

function sumMoney(values: MoneyInput[]): Money {
  return values.reduce((acc, v) => acc.add(money(v)), new Prisma.Decimal(0));
}

function allocationGross(a: AllocationLike): Money {
  return money(a.cashAmount).add(money(a.tdsAmount ?? 0));
}

export function calcInvoicePaidAmount(invoice: InvoiceLike, allocations: AllocationLike[]): Money {
  void invoice; // intentional: paid amount is derived purely from allocations
  return allocations.reduce((acc, a) => acc.add(allocationGross(a)), new Prisma.Decimal(0));
}

export function calcInvoiceBalance(invoice: InvoiceLike, allocations: AllocationLike[]): Money {
  return money(invoice.total).sub(calcInvoicePaidAmount(invoice, allocations));
}

export function calcInvoiceStatus(
  invoice: InvoiceLike,
  allocations: AllocationLike[],
  today: Date,
): "Draft" | "Sent" | "PartiallyPaid" | "Paid" | "Overdue" {
  const status = (invoice.status ?? "").toUpperCase();
  if (status === "DRAFT") return "Draft";

  const paid = calcInvoicePaidAmount(invoice, allocations);
  const balance = money(invoice.total).sub(paid);

  if (balance.lte(0)) return "Paid";
  if (paid.gt(0)) return "PartiallyPaid";

  const due = invoice.dueDate ? new Date(invoice.dueDate) : null;
  if (due && today.getTime() > due.getTime()) return "Overdue";

  return "Sent";
}

export function calcExpensePaidAmount(expense: ExpenseLike, allocations: AllocationLike[]): Money {
  void expense;
  return allocations.reduce((acc, a) => acc.add(allocationGross(a)), new Prisma.Decimal(0));
}

export function calcExpenseBalance(expense: ExpenseLike, allocations: AllocationLike[]): Money {
  return money(expense.total).sub(calcExpensePaidAmount(expense, allocations));
}

export function calcExpenseStatus(
  expense: ExpenseLike,
  allocations: AllocationLike[],
  today: Date,
): "Unpaid" | "PartiallyPaid" | "Paid" | "Overdue" {
  const paid = calcExpensePaidAmount(expense, allocations);
  const balance = money(expense.total).sub(paid);

  if (balance.lte(0)) return "Paid";
  if (paid.gt(0)) return "PartiallyPaid";

  const due = expense.dueDate ? new Date(expense.dueDate) : null;
  if (due && today.getTime() > due.getTime()) return "Overdue";

  return "Unpaid";
}

export function calcProjectSummary(
  project: ProjectLike,
  invoices: Array<InvoiceLike & { id: string; subtotal?: MoneyInput }>,
  expenses: Array<ExpenseLike & { id: string; subtotal?: MoneyInput }>,
  transactions: TransactionLike[],
  allocations: DocumentAllocationLike[],
) {
  const invoiceIds = new Set(invoices.map((i) => i.id));
  const expenseIds = new Set(expenses.map((e) => e.id));

  const allocByInvoiceId = new Map<string, AllocationLike[]>();
  const allocByExpenseId = new Map<string, AllocationLike[]>();

  for (const a of allocations) {
    if (a.invoiceId && invoiceIds.has(a.invoiceId)) {
      const list = allocByInvoiceId.get(a.invoiceId) ?? [];
      list.push(a);
      allocByInvoiceId.set(a.invoiceId, list);
    }
    if (a.expenseId && expenseIds.has(a.expenseId)) {
      const list = allocByExpenseId.get(a.expenseId) ?? [];
      list.push(a);
      allocByExpenseId.set(a.expenseId, list);
    }
  }

  const invoicesSubtotal = sumMoney(invoices.map((i) => i.subtotal ?? 0));
  const invoicesTotal = sumMoney(invoices.map((i) => i.total));
  const invoicesPaid = invoices.reduce(
    (acc, i) => acc.add(calcInvoicePaidAmount(i, allocByInvoiceId.get(i.id) ?? [])),
    new Prisma.Decimal(0),
  );
  const invoicesBalance = invoicesTotal.sub(invoicesPaid);

  const expensesSubtotal = sumMoney(expenses.map((e) => e.subtotal ?? 0));
  const expensesTotal = sumMoney(expenses.map((e) => e.total));
  const expensesPaid = expenses.reduce(
    (acc, e) => acc.add(calcExpensePaidAmount(e, allocByExpenseId.get(e.id) ?? [])),
    new Prisma.Decimal(0),
  );
  const expensesBalance = expensesTotal.sub(expensesPaid);

  const projectTxns = transactions.filter((t) => (t.projectId ?? null) === project.id);
  const cashIn = projectTxns
    .filter((t) => t.direction === "IN")
    .reduce((acc, t) => acc.add(money(t.amount)), new Prisma.Decimal(0));
  const cashOut = projectTxns
    .filter((t) => t.direction === "OUT")
    .reduce((acc, t) => acc.add(money(t.amount)), new Prisma.Decimal(0));
  const netCash = cashIn.sub(cashOut);

  const tdsIn = projectTxns
    .filter((t) => t.direction === "IN")
    .reduce((acc, t) => acc.add(money(t.tdsAmount ?? 0)), new Prisma.Decimal(0));
  const tdsOut = projectTxns
    .filter((t) => t.direction === "OUT")
    .reduce((acc, t) => acc.add(money(t.tdsAmount ?? 0)), new Prisma.Decimal(0));
  const netTds = tdsIn.sub(tdsOut);

  return {
    invoicesSubtotal,
    invoicesTotal,
    invoicesPaid,
    invoicesBalance,

    expensesSubtotal,
    expensesTotal,
    expensesPaid,
    expensesBalance,

    cashIn,
    cashOut,
    netCash,

    tdsIn,
    tdsOut,
    netTds,
  };
}

