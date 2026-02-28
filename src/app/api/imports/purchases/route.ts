import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";

import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";
import { parseMoney } from "@/lib/money";

export const runtime = "nodejs";

const ImportKindSchema = z.enum(["BILLS", "PAYMENTS_MADE"]);

const FormSchema = z.object({
  projectId: z.string().min(1),
  kind: ImportKindSchema,
  dryRun: z.boolean().optional(),
});

type ParsedRow = {
  rowNumber: number;
  date: Date;
  description: string;
  incoming: number;
  outgoing: number;
  modeRaw: string;
  categoryRaw: string;
  tds: number;
  reference: string;
  vendorGuess: string;
  errors: string[];
};

function detectDelimiter(firstLine: string) {
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  return tabCount >= commaCount ? "\t" : ",";
}

function parseDelimited(text: string) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [] as string[], rows: [] as string[][] };

  const delimiter = detectDelimiter(lines[0]);

  function parseLine(line: string): string[] {
    const out: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        const next = line[i + 1];
        if (inQuotes && next === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (!inQuotes && ch === delimiter) {
        out.push(current);
        current = "";
        continue;
      }
      current += ch;
    }
    out.push(current);
    return out.map((s) => s.trim());
  }

  const headers = parseLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map(parseLine);

  // Some exports include one or more "summary" lines before the actual header.
  // Detect the header row by looking for required columns.
  const required = ["date", "description"];
  const hasRequired = (cols: string[]) => {
    const set = new Set(cols.map((c) => c.trim().toLowerCase()));
    return required.every((r) => set.has(r));
  };

  if (hasRequired(headers)) return { headers, rows };

  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const candidate = parseLine(lines[i]).map((h) => h.trim());
    if (hasRequired(candidate)) {
      return { headers: candidate, rows: lines.slice(i + 1).map(parseLine) };
    }
  }

  return { headers, rows };
}

function parseDate(value: string) {
  const v = value.trim();
  // Expected: 02-Feb-2026 OR 2-Feb-26
  const m = v.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const mon = m[2].toLowerCase();
  const yearRaw = m[3];
  const yearNum = Number(yearRaw);
  const year = yearRaw.length === 2 ? 2000 + yearNum : yearNum;
  const monthMap: Record<string, number> = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };
  const month = monthMap[mon];
  if (month == null) return null;
  const d = new Date(Date.UTC(year, month, day));
  return Number.isNaN(d.getTime()) ? null : d;
}

function parsePaymentMode(modeRaw: string) {
  const m = modeRaw.trim().toLowerCase();
  if (!m) return null;
  if (m.includes("cash")) return "CASH";
  if (m.includes("upi")) return "UPI";
  if (m.includes("cheque") || m.includes("check")) return "CHEQUE";
  if (m.includes("card")) return "CARD";
  if (m.includes("bank") || m.includes("transfer") || m.includes("neft") || m.includes("imps") || m.includes("rtgs")) {
    return "BANK_TRANSFER";
  }
  return "OTHER";
}

function normalizeSpaces(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function guessVendorName(descriptionRaw: string, referenceRaw: string) {
  const ref = normalizeSpaces(referenceRaw);
  if (ref) {
    const parts = ref.split("/").map((p) => p.trim()).filter(Boolean);
    const head = (parts[0] || "").toUpperCase();
    if (head === "UPI" && parts.length >= 4) return parts[3];
    if ((head === "IFT" || head === "NEFT" || head === "IMPS" || head === "RTGS") && parts.length >= 3) return parts[2];
  }

  const desc = normalizeSpaces(descriptionRaw);
  if (!desc) return "Unknown Vendor";
  const first = desc.split("-")[0]?.trim() ?? desc;
  const cleaned = first.replace(/\(.*?\)/g, "").trim();
  return cleaned || "Unknown Vendor";
}

function pickCell(headers: string[], row: string[], want: string[]) {
  const idx = headers.findIndex((h) => want.some((w) => h.trim().toLowerCase() === w.toLowerCase()));
  return idx >= 0 ? (row[idx] ?? "").trim() : "";
}

function computeInvoiceNumber(seed: string) {
  const hash = createHash("sha1").update(seed).digest("hex").slice(0, 8).toUpperCase();
  return `CSV-${hash}`;
}

function parseRows(headers: string[], rows: string[][]): ParsedRow[] {
  const parsed: ParsedRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2; // 1-based lines, accounting for header
    const row = rows[i];
    const errors: string[] = [];

    const dateRaw = pickCell(headers, row, ["Date"]);
    const description = pickCell(headers, row, ["Description", "Narration", "Notes"]);
    const incomingRaw = pickCell(headers, row, ["Amount (Incoming)", "Incoming"]);
    const outgoingRaw = pickCell(headers, row, ["Amount", "Outgoing", "Debit"]);
    const modeRaw = pickCell(headers, row, ["Payment Mode", "Mode"]);
    const categoryRaw = pickCell(headers, row, ["Category", "Type"]);
    const tdsRaw = pickCell(headers, row, ["TDS"]);
    const reference = pickCell(headers, row, ["Transaction Reference", "Reference"]);

    const date = parseDate(dateRaw);
    if (!date) errors.push(`Invalid date: "${dateRaw}" (expected DD-MMM-YYYY)`);

    const incoming = parseMoney(incomingRaw);
    const outgoing = parseMoney(outgoingRaw);
    const tds = parseMoney(tdsRaw);

    if (!description) errors.push("Missing description");
    if (!incoming && !outgoing) errors.push("Missing amount (incoming or outgoing)");

    const vendorGuess = guessVendorName(description, reference);

    if (!errors.length && date) {
      parsed.push({
        rowNumber,
        date,
        description,
        incoming,
        outgoing,
        modeRaw,
        categoryRaw,
        tds,
        reference,
        vendorGuess,
        errors,
      });
    } else {
      parsed.push({
        rowNumber,
        date: date ?? new Date(0),
        description,
        incoming,
        outgoing,
        modeRaw,
        categoryRaw,
        tds,
        reference,
        vendorGuess,
        errors,
      });
    }
  }
  return parsed;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file");
  const projectId = String(formData.get("projectId") ?? "");
  const kindRaw = String(formData.get("kind") ?? "");
  const dryRun = String(formData.get("dryRun") ?? "") === "1";

  const parsedForm = FormSchema.safeParse({ projectId, kind: kindRaw, dryRun });
  if (!parsedForm.success) {
    return NextResponse.json({ ok: false, error: "Invalid form", details: parsedForm.error.flatten() }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Missing file" }, { status: 400 });
  }

  const text = await file.text();
  const { headers, rows } = parseDelimited(text);
  if (headers.length === 0) {
    return NextResponse.json({ ok: false, error: "Empty CSV" }, { status: 400 });
  }

  const parsedRows = parseRows(headers, rows).slice(0, 2000);
  const relevantRows = parsedRows.filter((r) => (parsedForm.data.kind === "BILLS" ? r.outgoing > 0 : r.outgoing > 0));

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      kind: parsedForm.data.kind,
      headers,
      totalRows: parsedRows.length,
      relevantRows: relevantRows.length,
      rows: relevantRows.slice(0, 50),
      errors: parsedRows.filter((r) => r.errors.length > 0).slice(0, 50),
    });
  }

  const tenantId = session.user.tenantId;

  const result = await prisma.$transaction(async (tx) => {
    const vendorCache = new Map<string, string>();
    const categoryCache = new Map<string, string>();
    const itemCache = new Map<string, string>();

    async function getOrCreateVendor(nameRaw: string, tradeRaw: string) {
      const name = normalizeSpaces(nameRaw);
      const key = name.toLowerCase();
      const cached = vendorCache.get(key);
      if (cached) return cached;

      const existing = await tx.vendor.findFirst({
        where: { tenantId, name: { equals: name, mode: "insensitive" } },
        select: { id: true },
      });
      if (existing) {
        vendorCache.set(key, existing.id);
        return existing.id;
      }

      const created = await tx.vendor.create({
        data: {
          tenantId,
          name,
          trade: tradeRaw ? normalizeSpaces(tradeRaw) : null,
          active: true,
          isSubcontractor: tradeRaw.trim().toLowerCase() === "labour",
        },
        select: { id: true },
      });
      vendorCache.set(key, created.id);
      return created.id;
    }

    async function getOrCreateExpenseCategory(nameRaw: string) {
      const name = normalizeSpaces(nameRaw || "Imported");
      const key = name.toLowerCase();
      const cached = categoryCache.get(key);
      if (cached) return cached;

      const existing = await tx.txnCategory.findFirst({
        where: { tenantId, type: "EXPENSE", name: { equals: name, mode: "insensitive" } },
        select: { id: true },
      });
      if (existing) {
        categoryCache.set(key, existing.id);
        return existing.id;
      }

      const created = await tx.txnCategory.create({
        data: { tenantId, type: "EXPENSE", name, active: true },
        select: { id: true },
      });
      categoryCache.set(key, created.id);
      return created.id;
    }

    async function getOrCreateImportedItem(categoryRaw: string) {
      const category = normalizeSpaces(categoryRaw || "Service");
      const type = category.toLowerCase().includes("material") ? "MATERIAL" : "SERVICE";
      const name = `Imported - ${category}`;
      const key = `${type}:${name}`.toLowerCase();
      const cached = itemCache.get(key);
      if (cached) return cached;

      const existing = await tx.item.findFirst({
        where: { tenantId, type, name: { equals: name, mode: "insensitive" } },
        select: { id: true },
      });
      if (existing) {
        itemCache.set(key, existing.id);
        return existing.id;
      }

      const created = await tx.item.create({
        data: { tenantId, name, type, unit: "nos", gstRate: 0 },
        select: { id: true },
      });
      itemCache.set(key, created.id);
      return created.id;
    }

    let created = 0;
    let skipped = 0;
    const rowErrors: Array<{ rowNumber: number; errors: string[] }> = [];

    for (const r of relevantRows) {
      if (r.errors.length > 0) {
        skipped++;
        rowErrors.push({ rowNumber: r.rowNumber, errors: r.errors });
        continue;
      }
      if (parsedForm.data.kind === "BILLS") {
        const vendorId = await getOrCreateVendor(r.vendorGuess, r.categoryRaw);
        const invoiceNumber = computeInvoiceNumber(
          `${r.date.toISOString().slice(0, 10)}|${vendorId}|${r.outgoing}|${r.reference}|${r.description}`,
        );

        const itemId = await getOrCreateImportedItem(r.categoryRaw);

        await tx.purchaseInvoice.upsert({
          where: { tenantId_vendorId_invoiceNumber: { tenantId, vendorId, invoiceNumber } },
          update: {
            invoiceDate: r.date,
            projectId: parsedForm.data.projectId,
            gstType: "INTRA",
            taxableValue: r.outgoing,
            cgst: 0,
            sgst: 0,
            igst: 0,
            total: r.outgoing,
          },
          create: {
            tenantId,
            vendorId,
            invoiceNumber,
            invoiceDate: r.date,
            projectId: parsedForm.data.projectId,
            gstType: "INTRA",
            taxableValue: r.outgoing,
            cgst: 0,
            sgst: 0,
            igst: 0,
            total: r.outgoing,
            lines: {
              create: [
                {
                  tenantId,
                  itemId,
                  quantity: 1,
                  rate: r.outgoing,
                  amount: r.outgoing,
                  projectId: parsedForm.data.projectId,
                },
              ],
            },
          },
        });

        created++;
        continue;
      }

      // PAYMENTS_MADE
      const vendorId = await getOrCreateVendor(r.vendorGuess, r.categoryRaw);
      const categoryId = await getOrCreateExpenseCategory(r.categoryRaw);
      const mode = parsePaymentMode(r.modeRaw);
      if (!mode) {
        skipped++;
        rowErrors.push({ rowNumber: r.rowNumber, errors: [`Unknown payment mode: "${r.modeRaw}"`] });
        continue;
      }

      const cash = r.outgoing;
      const tds = r.tds;
      const reference = r.reference ? normalizeSpaces(r.reference) : null;

      // Best-effort dedupe: if an exact match exists, skip.
      const existing = await tx.transaction.findFirst({
        where: {
          tenantId,
          type: "EXPENSE",
          date: r.date,
          vendorId,
          amount: cash,
          tdsAmount: tds,
          mode,
          reference: reference ?? undefined,
          note: r.description,
        },
        select: { id: true },
      });
      if (existing) {
        skipped++;
        continue;
      }

      await tx.transaction.create({
        data: {
          tenantId,
          type: "EXPENSE",
          date: r.date,
          amount: cash,
          tdsAmount: tds,
          tdsBaseAmount: cash + tds,
          projectId: parsedForm.data.projectId,
          vendorId,
          categoryId,
          mode,
          reference,
          note: r.description,
          description: r.description,
        },
        select: { id: true },
      });

      created++;
    }

    return { created, skipped, rowErrors };
  });

  return NextResponse.json({ ok: true, dryRun: false, kind: parsedForm.data.kind, ...result });
}
