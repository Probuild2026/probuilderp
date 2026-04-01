import { NextResponse } from "next/server";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as XLSX from "xlsx";

export type ExportFormat = "csv" | "xlsx" | "pdf";

export type TabularColumn = {
  key: string;
  label: string;
  width?: number;
  align?: "left" | "right";
};

export type TabularRow = Record<string, string | number | null | undefined>;

export type TabularDataset = {
  title: string;
  filenameBase: string;
  columns: TabularColumn[];
  rows: TabularRow[];
  metaLines?: string[];
};

function cellValue(value: string | number | null | undefined) {
  return value ?? "";
}

function cellText(value: string | number | null | undefined) {
  return String(cellValue(value));
}

function csvEscape(value: string | number | null | undefined) {
  const text = cellText(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function safeFilename(name: string) {
  return name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function buildCsv(dataset: TabularDataset) {
  const lines = [
    dataset.columns.map((column) => csvEscape(column.label)).join(","),
    ...dataset.rows.map((row) => dataset.columns.map((column) => csvEscape(row[column.key])).join(",")),
  ];
  return `\uFEFF${lines.join("\n")}\n`;
}

function buildXlsx(dataset: TabularDataset) {
  const aoa = [
    dataset.columns.map((column) => column.label),
    ...dataset.rows.map((row) => dataset.columns.map((column) => cellValue(row[column.key]))),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet["!cols"] = dataset.columns.map((column) => ({ wch: column.width ?? Math.max(column.label.length + 2, 12) }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, dataset.title.slice(0, 31));

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const bytes = Uint8Array.from(buffer);
  return bytes.buffer;
}

function ellipsize(text: string, maxWidth: number, widthOf: (value: string) => number) {
  if (maxWidth <= 0) return "";
  if (widthOf(text) <= maxWidth) return text;

  const suffix = "...";
  let end = text.length;
  while (end > 0 && widthOf(text.slice(0, end) + suffix) > maxWidth) {
    end -= 1;
  }
  return end > 0 ? `${text.slice(0, end)}${suffix}` : suffix;
}

async function buildPdf(dataset: TabularDataset) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 842;
  const pageHeight = 595;
  const marginX = 24;
  const marginTop = 24;
  const marginBottom = 24;
  const titleSize = 14;
  const metaSize = 8;
  const textSize = 8;
  const headerHeight = 18;
  const rowHeight = 16;
  const cellPadding = 4;
  const availableWidth = pageWidth - marginX * 2;
  const totalWeight = dataset.columns.reduce((sum, column) => sum + (column.width ?? 12), 0);
  const columnWidths = dataset.columns.map((column) => (availableWidth * (column.width ?? 12)) / totalWeight);

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - marginTop;

  const normalWidth = (value: string) => font.widthOfTextAtSize(value, textSize);
  const boldWidth = (value: string) => bold.widthOfTextAtSize(value, textSize);

  function drawHeader() {
    page.drawText(dataset.title, {
      x: marginX,
      y,
      size: titleSize,
      font: bold,
    });
    y -= titleSize + 6;

    for (const line of dataset.metaLines ?? []) {
      page.drawText(line, {
        x: marginX,
        y,
        size: metaSize,
        font,
        color: rgb(0.35, 0.35, 0.35),
      });
      y -= metaSize + 4;
    }

    y -= 4;

    let x = marginX;
    for (let index = 0; index < dataset.columns.length; index += 1) {
      const column = dataset.columns[index]!;
      const width = columnWidths[index]!;
      page.drawRectangle({
        x,
        y: y - headerHeight + 3,
        width,
        height: headerHeight,
        color: rgb(0.93, 0.93, 0.93),
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 0.5,
      });
      page.drawText(ellipsize(column.label, width - cellPadding * 2, boldWidth), {
        x: x + cellPadding,
        y: y - 11,
        size: textSize,
        font: bold,
      });
      x += width;
    }

    y -= headerHeight;
  }

  function addPage() {
    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - marginTop;
    drawHeader();
  }

  drawHeader();

  for (const row of dataset.rows) {
    if (y - rowHeight < marginBottom) addPage();

    let x = marginX;
    for (let index = 0; index < dataset.columns.length; index += 1) {
      const column = dataset.columns[index]!;
      const width = columnWidths[index]!;
      const raw = cellText(row[column.key]);
      const text = ellipsize(raw, width - cellPadding * 2, normalWidth);
      const textWidth = normalWidth(text);
      const textX = column.align === "right" ? x + width - cellPadding - textWidth : x + cellPadding;

      page.drawRectangle({
        x,
        y: y - rowHeight + 3,
        width,
        height: rowHeight,
        borderColor: rgb(0.88, 0.88, 0.88),
        borderWidth: 0.5,
      });
      page.drawText(text, {
        x: textX,
        y: y - 11,
        size: textSize,
        font,
      });
      x += width;
    }

    y -= rowHeight;
  }

  const bytes = await pdf.save();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function createTabularExportResponse(dataset: TabularDataset, format: ExportFormat) {
  const filename = safeFilename(dataset.filenameBase);

  if (format === "xlsx") {
    const body = new Blob([buildXlsx(dataset)]);
    return new NextResponse(body, {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${filename}.xlsx"`,
      },
    });
  }

  if (format === "pdf") {
    const body = new Blob([await buildPdf(dataset)]);
    return new NextResponse(body, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${filename}.pdf"`,
      },
    });
  }

  return new NextResponse(buildCsv(dataset), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}.csv"`,
    },
  });
}
