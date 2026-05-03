export type ModuleKey =
  | "expenses"
  | "bills"
  | "paymentsMade"
  | "invoices"
  | "receipts"
  | "transactions"
  | "wages";

export interface ModuleCheatSheetConfig {
  key: ModuleKey;
  title: string;
  summary: string;
  useWhen: string[];
  doNotUseWhen: string[];
  examples: string[];
  decisionHints?: string[];
  relatedLinks?: { label: string; href: string }[];
  createHref: string;
}

export const MODULE_CHEAT_SHEETS: Record<ModuleKey, ModuleCheatSheetConfig> = {
  expenses: {
    key: "expenses",
    title: "What goes in Expenses",
    summary: "Use this for direct project costs that are not being tracked as a formal vendor bill.",
    useWhen: [
      "You paid for petty cash, transport, food, tools, fuel, loading/unloading, or one-off site costs",
      "You paid labour or a provider informally and there is no formal bill to track",
      "You want the project cost recorded even if it was paid in cash",
    ],
    doNotUseWhen: [
      "A vendor or subcontractor has given you a proper bill or invoice, use Bills",
      "You are recording money received from the client, use Receipts",
      "You are only moving money between bank and cash, use Transactions",
    ],
    examples: [
      "Soft drinks for concrete gang",
      "Cutting blade for angle grinder",
      "Cash paid to extra labour for one-day work",
    ],
    decisionHints: [
      "Proper vendor bill? → Bills",
      "No bill, just cost incurred? → Expenses",
      "Client paid you? → Receipts",
    ],
    relatedLinks: [
      { label: "Create bill", href: "/app/purchases/bills/new" },
      { label: "Create receipt", href: "/app/sales/receipts/new" },
      { label: "Create transaction", href: "/app/transactions/new" },
    ],
    createHref: "/app/expenses/new",
  },
  bills: {
    key: "bills",
    title: "What goes in Bills",
    summary: "Use this when a vendor or subcontractor gives you a proper bill/invoice and you want to formally track the payable.",
    useWhen: [
      "Supplier or subcontractor has given a bill",
      "You need to capture GST/TDS or document-backed payables",
      "You may pay the amount later or in parts",
    ],
    doNotUseWhen: [
      "It is only a small site expense without a bill, use Expenses",
      "You are recording the payment itself after the bill is already created, use Payments Made",
    ],
    examples: [
      "Steel supplier invoice",
      "Material supplier GST bill",
      "Subcontractor stage bill",
    ],
    relatedLinks: [
      { label: "Create payment", href: "/app/purchases/payments-made/new" },
      { label: "Create expense", href: "/app/expenses/new" },
    ],
    createHref: "/app/purchases/bills/new",
  },
  paymentsMade: {
    key: "paymentsMade",
    title: "What goes in Payments Made",
    summary: "Use this only when you are paying against an existing Bill.",
    useWhen: [
      "A Bill already exists and you are now recording payment",
      "Payment is full or partial",
      "Payment happened by bank, UPI, or cash",
    ],
    doNotUseWhen: [
      "There is no bill and you are just recording a direct cost, use Expenses",
      "You are entering a fresh vendor demand document, use Bills",
    ],
    examples: [
      "Part payment for steel bill",
      "Final settlement for subcontractor invoice",
    ],
    relatedLinks: [
      { label: "Create bill", href: "/app/purchases/bills/new" },
      { label: "Create expense", href: "/app/expenses/new" },
    ],
    createHref: "/app/purchases/payments-made/new",
  },
  invoices: {
    key: "invoices",
    title: "What goes in Invoices",
    summary: "Use this to record what the client is supposed to pay you as per contract stage, milestone, or billing event.",
    useWhen: [
      "You want to raise a demand on the client",
      "You want to track what is due, not just what is received",
      "You are billing by milestone or stage completion",
    ],
    doNotUseWhen: [
      "The client has already paid and you are recording actual receipt, use Receipts",
    ],
    examples: [
      "Foundation stage invoice",
      "Plinth completion invoice",
      "Material advance demand",
    ],
    relatedLinks: [
      { label: "Create receipt", href: "/app/sales/receipts/new" },
    ],
    createHref: "/app/sales/invoices/new",
  },
  receipts: {
    key: "receipts",
    title: "What goes in Receipts",
    summary: "Use this whenever money is actually received from the client.",
    useWhen: [
      "Client paid by bank transfer, UPI, cheque, or cash",
      "You want to track actual inflow into the project",
      "You are closing or partially settling an Invoice",
    ],
    doNotUseWhen: [
      "You are only creating a demand to the client, use Invoices",
      "You are recording vendor payment, use Payments Made or Expenses",
    ],
    examples: [
      "Client paid first stage by bank",
      "Client gave cash advance",
      "Partial milestone receipt",
    ],
    relatedLinks: [
      { label: "Create invoice", href: "/app/sales/invoices/new" },
      { label: "Create payment", href: "/app/purchases/payments-made/new" },
      { label: "Create expense", href: "/app/expenses/new" },
    ],
    createHref: "/app/sales/receipts/new",
  },
  transactions: {
    key: "transactions",
    title: "What Transactions Shows",
    summary: "Use this ledger as the full cash movement roll-up. Receipts, vendor payments, direct paid expenses, wages, partner payouts, TDS payments, and manual transfers appear here together.",
    useWhen: [
      "You need one date-range view of money in and money out",
      "You want to reconcile receipts, payments, expenses, wages, and partner payouts together",
      "You need to add a transfer or funding movement that does not belong in another module",
    ],
    doNotUseWhen: [
      "You are entering a vendor bill, receipt, direct expense, wage sheet, or partner payout; enter it in its source module and it will roll up here",
      "You need the original bill, invoice, or payout details; open the source row from this ledger",
    ],
    examples: [
      "Review all cash movement for April",
      "Open a direct expense or receipt from the ledger",
      "Transfer owner funds into business account",
    ],
    relatedLinks: [
      { label: "Create expense", href: "/app/expenses/new" },
      { label: "Create payment", href: "/app/purchases/payments-made/new" },
      { label: "Create receipt", href: "/app/sales/receipts/new" },
    ],
    createHref: "/app/transactions/new",
  },
  wages: {
    key: "wages",
    title: "What goes in Wages",
    summary: "Use this when worker wages are being tracked separately from vendor bills and general expenses.",
    useWhen: [
      "Daily wage labour is maintained separately",
      "Attendance-linked labour payments are needed",
    ],
    doNotUseWhen: [
      "Labour is part of a subcontractor bill, use Bills",
      "Informal one-off labour cost is being tracked as direct expense, use Expenses",
    ],
    examples: [
      "Mason daily wage entry",
      "Weekly labour payout register",
    ],
    decisionHints: [
      "Labour tracked worker by worker? → Wages",
      "Subcontractor sent a bill? → Bills",
      "One-off casual labour cost only? → Expenses",
    ],
    relatedLinks: [
      { label: "Create bill", href: "/app/purchases/bills/new" },
      { label: "Create expense", href: "/app/expenses/new" },
    ],
    createHref: "/app/wages/new",
  },
};
