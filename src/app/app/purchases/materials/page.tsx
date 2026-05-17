import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { PackageCheck, PackageOpen, ReceiptText, Truck } from "lucide-react";
import { Prisma } from "@prisma/client";

import { PageHeader } from "@/components/app/page-header";
import { TableEmptyState } from "@/components/app/state-panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildInclusiveDateRange, getSingleSearchParam, parseDateRangeParams } from "@/lib/date-range";
import { formatINR } from "@/lib/money";
import { getSelectedProjectId } from "@/lib/project-filter";
import { authOptions } from "@/server/auth";
import { prisma } from "@/server/db";

import {
  LinkReceiptBillForm,
  MaterialOrderActions,
  MaterialReceiptActions,
  NewMaterialOrderDialog,
  NewMaterialReceiptDialog,
  type BillOption,
} from "./material-forms";

type MaterialPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function dateOnly(date?: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "-";
}

function qty(value: number, unit?: string | null) {
  const formatted = value.toLocaleString("en-IN", { maximumFractionDigits: 3 });
  return unit ? `${formatted} ${unit}` : formatted;
}

function statusTone(status: "ORDERED" | "PARTIALLY_DELIVERED" | "DELIVERED" | "CANCELLED") {
  if (status === "DELIVERED") return "secondary";
  if (status === "CANCELLED") return "destructive";
  return "outline";
}

export default async function MaterialTrackingPage({ searchParams }: MaterialPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const sp = (await searchParams) ?? {};
  const q = getSingleSearchParam(sp, "q");
  const { from, to } = parseDateRangeParams(sp);
  const dateRange = buildInclusiveDateRange(from, to);
  const selectedProjectId = await getSelectedProjectId();

  const [projects, vendors, items] = await Promise.all([
    prisma.project.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
      take: 500,
    }),
    prisma.vendor.findMany({
      where: { tenantId: session.user.tenantId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
      take: 500,
    }),
    prisma.item.findMany({
      where: {
        tenantId: session.user.tenantId,
        type: "MATERIAL",
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, unit: true },
      take: 300,
    }),
  ]);

  const itemIds = items.map((item) => item.id);
  const activeProject = selectedProjectId ? projects.find((project) => project.id === selectedProjectId) : null;

  const orderWhere: Prisma.MaterialOrderWhereInput = {
    tenantId: session.user.tenantId,
    ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
    ...(itemIds.length > 0 ? { itemId: { in: itemIds } } : q ? { itemId: { in: [] } } : {}),
    ...(from || to ? { orderDate: dateRange } : {}),
  };
  const receiptWhere: Prisma.MaterialReceiptWhereInput = {
    tenantId: session.user.tenantId,
    ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
    ...(itemIds.length > 0 ? { itemId: { in: itemIds } } : q ? { itemId: { in: [] } } : {}),
    ...(from || to ? { receiptDate: dateRange } : {}),
  };
  const movementWhere: Prisma.StockMovementWhereInput = {
    tenantId: session.user.tenantId,
    ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
    ...(itemIds.length > 0 ? { itemId: { in: itemIds } } : q ? { itemId: { in: [] } } : {}),
  };

  const [orders, receipts, orderAgg, receiptAgg, movementAgg, stageMovements, bills] = await Promise.all([
    prisma.materialOrder.findMany({
      where: orderWhere,
      orderBy: [{ orderDate: "desc" }, { createdAt: "desc" }],
      include: {
        project: { select: { id: true, name: true } },
        vendor: { select: { id: true, name: true } },
        item: { select: { id: true, name: true, unit: true } },
        receipts: { select: { quantity: true } },
      },
      take: 80,
    }),
    prisma.materialReceipt.findMany({
      where: receiptWhere,
      orderBy: [{ receiptDate: "desc" }, { createdAt: "desc" }],
      include: {
        project: { select: { id: true, name: true } },
        vendor: { select: { id: true, name: true } },
        item: { select: { id: true, name: true, unit: true } },
        materialOrder: { select: { id: true, reference: true } },
        purchaseInvoice: { select: { id: true, invoiceNumber: true, invoiceDate: true, total: true } },
      },
      take: 120,
    }),
    prisma.materialOrder.groupBy({
      by: ["itemId"],
      where: orderWhere,
      _max: { orderDate: true },
      _sum: { quantityOrdered: true },
    }),
    prisma.materialReceipt.groupBy({
      by: ["itemId"],
      where: receiptWhere,
      _max: { receiptDate: true },
      _sum: { quantity: true },
    }),
    prisma.stockMovement.groupBy({
      by: ["itemId", "direction"],
      where: movementWhere,
      _sum: { quantity: true },
    }),
    prisma.stockMovement.findMany({
      where: { ...movementWhere, direction: "OUT" },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        date: true,
        itemId: true,
        quantity: true,
        stageName: true,
        remarks: true,
        item: { select: { id: true, name: true, unit: true } },
      },
      take: 200,
    }),
    prisma.purchaseInvoice.findMany({
      where: {
        tenantId: session.user.tenantId,
        ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
      },
      orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        vendorId: true,
        projectId: true,
        invoiceNumber: true,
        invoiceDate: true,
        total: true,
        vendor: { select: { name: true } },
        project: { select: { name: true } },
      },
      take: 300,
    }),
  ]);

  const billIds = bills.map((bill) => bill.id);
  const paid = billIds.length
    ? await prisma.transactionAllocation.groupBy({
        by: ["documentId"],
        where: {
          tenantId: session.user.tenantId,
          documentType: "PURCHASE_INVOICE",
          documentId: { in: billIds },
        },
        _sum: { grossAmount: true },
      })
    : [];
  const paidByBillId = new Map(paid.map((row) => [row.documentId, Number(row._sum.grossAmount ?? 0)]));
  const billBalanceById = new Map<string, number>();
  const openBills: BillOption[] = [];
  let openBillCount = 0;
  let openBillBalance = 0;
  for (const bill of bills) {
    const total = Number(bill.total);
    const balance = Math.max(0, total - (paidByBillId.get(bill.id) ?? 0));
    billBalanceById.set(bill.id, balance);
    if (balance > 1) {
      openBillCount += 1;
      openBillBalance += balance;
      openBills.push({
        id: bill.id,
        projectId: bill.projectId,
        vendorId: bill.vendorId,
        balance,
        label: `${bill.invoiceNumber} • ${bill.vendor.name} • ${formatINR(balance)} open`,
      });
    }
  }

  const orderAggByItemId = new Map(orderAgg.map((row) => [row.itemId, row]));
  const receiptAggByItemId = new Map(receiptAgg.map((row) => [row.itemId, row]));
  const stockByItemId = new Map<string, { inQty: number; outQty: number }>();
  for (const movement of movementAgg) {
    const entry = stockByItemId.get(movement.itemId) ?? { inQty: 0, outQty: 0 };
    const value = Number(movement._sum.quantity ?? 0);
    if (movement.direction === "IN") entry.inQty += value;
    if (movement.direction === "OUT") entry.outQty += value;
    stockByItemId.set(movement.itemId, entry);
  }

  const stageUsageByKey = new Map<string, { itemName: string; unit?: string | null; stageName: string; quantity: number; lastDate: Date; remarks?: string | null }>();
  for (const movement of stageMovements) {
    const stageName = movement.stageName?.trim() || "Unspecified";
    const key = `${movement.itemId}:${stageName}`;
    const existing = stageUsageByKey.get(key);
    const quantity = Number(movement.quantity);
    if (existing) {
      existing.quantity += quantity;
      if (movement.date > existing.lastDate) existing.lastDate = movement.date;
    } else {
      stageUsageByKey.set(key, {
        itemName: movement.item.name,
        unit: movement.item.unit,
        stageName,
        quantity,
        lastDate: movement.date,
        remarks: movement.remarks,
      });
    }
  }
  const stageUsage = [...stageUsageByKey.values()]
    .sort((a, b) => b.lastDate.getTime() - a.lastDate.getTime())
    .slice(0, 24);

  const unbilledReceipts = receipts.filter((receipt) => !receipt.purchaseInvoiceId);
  const deliveredThisView = receiptAgg.reduce((acc, row) => acc + Number(row._sum.quantity ?? 0), 0);
  const orderedThisView = orderAgg.reduce((acc, row) => acc + Number(row._sum.quantityOrdered ?? 0), 0);

  const allOrderOptions = orders.map((order) => ({
      id: order.id,
      projectId: order.projectId,
      vendorId: order.vendorId,
      itemId: order.itemId,
      stageName: order.stageName,
      rate: order.rate == null ? null : Number(order.rate),
      label: `${dateOnly(order.orderDate)} • ${order.item.name} • ${order.vendor.name} • ${qty(Number(order.quantityOrdered), order.item.unit)}`,
    }));
  const orderOptions = allOrderOptions.filter((order) => {
    const source = orders.find((entry) => entry.id === order.id);
    return source?.status !== "DELIVERED" && source?.status !== "CANCELLED";
  });

  return (
    <div className="w-full space-y-6 p-4 md:p-6">
      <PageHeader
        eyebrow="Purchases / Materials"
        title="Material tracking"
        description="Track orders, site deliveries, stock movement, bill linkage, and stage-wise material usage."
        actions={
          <>
            <NewMaterialReceiptDialog
              projects={projects}
              vendors={vendors}
              items={items}
              orders={orderOptions}
              bills={openBills}
              selectedProjectId={selectedProjectId}
            />
            <NewMaterialOrderDialog projects={projects} vendors={vendors} items={items} selectedProjectId={selectedProjectId} />
          </>
        }
        filters={
          <form className="flex flex-wrap items-end gap-3" action="/app/purchases/materials" method="get">
            <div className="text-sm text-muted-foreground">
              Project: <span className="text-foreground">{activeProject?.name ?? "All projects"}</span>
            </div>
            <Input name="q" placeholder="Search material..." defaultValue={q} className="max-w-sm" />
            <Input name="from" type="date" defaultValue={from} />
            <Input name="to" type="date" defaultValue={to} />
            <Button type="submit">Apply</Button>
            <Button type="button" variant="secondary" asChild>
              <Link href="/app/purchases/materials">Reset</Link>
            </Button>
          </form>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile icon={PackageCheck} label="Ordered qty" value={orderedThisView.toLocaleString("en-IN", { maximumFractionDigits: 3 })} />
        <SummaryTile icon={Truck} label="Delivered qty" value={deliveredThisView.toLocaleString("en-IN", { maximumFractionDigits: 3 })} />
        <SummaryTile icon={PackageOpen} label="Unbilled deliveries" value={String(unbilledReceipts.length)} emphasis />
        <SummaryTile icon={ReceiptText} label="Open bill balance" value={formatINR(openBillBalance)} meta={`${openBillCount} bills`} />
      </section>

      <Card>
        <CardHeader className="border-b border-border/60">
          <CardTitle className="text-base">Material status by item</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[1040px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Last ordered</TableHead>
                  <TableHead>Last delivered</TableHead>
                  <TableHead className="text-right">Ordered</TableHead>
                  <TableHead className="text-right">Delivered</TableHead>
                  <TableHead className="text-right">Used</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableEmptyState colSpan={8} title="No materials found" description="Add material items such as sand, cement, steel, aggregate, or other site purchases." />
                ) : (
                  items.map((item) => {
                    const ordered = Number(orderAggByItemId.get(item.id)?._sum.quantityOrdered ?? 0);
                    const delivered = Number(receiptAggByItemId.get(item.id)?._sum.quantity ?? 0);
                    const stock = stockByItemId.get(item.id) ?? { inQty: 0, outQty: 0 };
                    const balance = stock.inQty - stock.outQty;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.unit ?? "-"}</TableCell>
                        <TableCell>{dateOnly(orderAggByItemId.get(item.id)?._max.orderDate)}</TableCell>
                        <TableCell>{dateOnly(receiptAggByItemId.get(item.id)?._max.receiptDate)}</TableCell>
                        <TableCell className="text-right tabular-nums">{qty(ordered)}</TableCell>
                        <TableCell className="text-right tabular-nums">{qty(delivered)}</TableCell>
                        <TableCell className="text-right tabular-nums">{qty(stock.outQty)}</TableCell>
                        <TableCell className="text-right tabular-nums">{qty(balance)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base">Delivery ledger</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[1160px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Challan</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Bill</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.length === 0 ? (
                    <TableEmptyState colSpan={10} title="No deliveries recorded" description="Record delivery challans to create stock IN and keep vendor billing traceable." />
                  ) : (
                    receipts.map((receipt) => {
                      const billBalance = receipt.purchaseInvoiceId ? (billBalanceById.get(receipt.purchaseInvoiceId) ?? 0) : 0;
                      return (
                        <TableRow key={receipt.id}>
                          <TableCell>{dateOnly(receipt.receiptDate)}</TableCell>
                          <TableCell className="font-medium">{receipt.item.name}</TableCell>
                          <TableCell>{receipt.vendor.name}</TableCell>
                          <TableCell>{receipt.project.name}</TableCell>
                          <TableCell>{receipt.challanNumber ?? "-"}</TableCell>
                          <TableCell>{receipt.stageName ?? "-"}</TableCell>
                          <TableCell className="text-right tabular-nums">{qty(Number(receipt.quantity), receipt.item.unit)}</TableCell>
                          <TableCell className="text-right tabular-nums">{receipt.amount == null ? "-" : formatINR(Number(receipt.amount))}</TableCell>
                          <TableCell>
                            {receipt.purchaseInvoice ? (
                              <div className="space-y-1">
                                <Link className="font-medium hover:underline" href={`/app/purchases/bills/${receipt.purchaseInvoice.id}`}>
                                  {receipt.purchaseInvoice.invoiceNumber}
                                </Link>
                                <div className="text-xs text-muted-foreground">{billBalance > 1 ? `${formatINR(billBalance)} open` : "Settled / no open balance"}</div>
                              </div>
                            ) : (
                              <LinkReceiptBillForm receiptId={receipt.id} projectId={receipt.projectId} vendorId={receipt.vendorId} bills={openBills} />
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <MaterialReceiptActions
                              projects={projects}
                              vendors={vendors}
                              items={items}
                              orders={allOrderOptions}
                              bills={openBills}
                              receipt={{
                                id: receipt.id,
                                projectId: receipt.projectId,
                                vendorId: receipt.vendorId,
                                itemId: receipt.itemId,
                                materialOrderId: receipt.materialOrderId ?? "",
                                purchaseInvoiceId: receipt.purchaseInvoiceId ?? "",
                                receiptDate: dateOnly(receipt.receiptDate),
                                challanNumber: receipt.challanNumber ?? "",
                                quantity: Number(receipt.quantity).toString(),
                                unitCost: receipt.unitCost == null ? "" : Number(receipt.unitCost).toString(),
                                stageName: receipt.stageName ?? "",
                                vehicleNumber: receipt.vehicleNumber ?? "",
                                remarks: receipt.remarks ?? "",
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/60">
            <CardTitle className="text-base">Stage usage from stock OUT</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-6">
            {stageUsage.length === 0 ? (
              <div className="rounded-[20px] border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
                No stage-wise material usage yet. Use Inventory, then Add Stock Movement with OUT direction and fill the stage / usage area.
              </div>
            ) : (
              stageUsage.map((entry) => (
                <div key={`${entry.itemName}-${entry.stageName}`} className="rounded-[18px] border border-border/60 bg-background/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{entry.stageName}</div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">{entry.itemName}</div>
                    </div>
                    <div className="text-right text-sm font-semibold tabular-nums">{qty(entry.quantity, entry.unit)}</div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">Last used {dateOnly(entry.lastDate)}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="border-b border-border/60">
          <CardTitle className="text-base">Order queue</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[1040px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Order date</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Ordered</TableHead>
                  <TableHead className="text-right">Delivered</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableEmptyState colSpan={10} title="No material orders recorded" description="Add an order when material is requested from a vendor before the delivery arrives." />
                ) : (
                  orders.filter(o => o.status !== "DELIVERED" && o.status !== "CANCELLED").map((order) => {
                    const delivered = order.receipts.reduce((acc, receipt) => acc + Number(receipt.quantity), 0);
                    return (
                      <TableRow key={order.id}>
                        <TableCell>{dateOnly(order.orderDate)}</TableCell>
                        <TableCell className="font-medium">{order.item.name}</TableCell>
                        <TableCell>{order.vendor.name}</TableCell>
                        <TableCell>{order.project.name}</TableCell>
                        <TableCell>{dateOnly(order.expectedDeliveryDate)}</TableCell>
                        <TableCell>{order.stageName ?? "-"}</TableCell>
                        <TableCell className="text-right tabular-nums">{qty(Number(order.quantityOrdered), order.item.unit)}</TableCell>
                        <TableCell className="text-right tabular-nums">{qty(delivered, order.item.unit)}</TableCell>
                        <TableCell>
                          <Badge variant={statusTone(order.status)}>{order.status.replace(/_/g, " ")}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <MaterialOrderActions
                            projects={projects}
                            vendors={vendors}
                            items={items}
                            order={{
                              id: order.id,
                              projectId: order.projectId,
                              vendorId: order.vendorId,
                              itemId: order.itemId,
                              orderDate: dateOnly(order.orderDate),
                              expectedDeliveryDate: order.expectedDeliveryDate ? dateOnly(order.expectedDeliveryDate) : "",
                              quantityOrdered: Number(order.quantityOrdered).toString(),
                              rate: order.rate == null ? "" : Number(order.rate).toString(),
                              stageName: order.stageName ?? "",
                              reference: order.reference ?? "",
                              remarks: order.remarks ?? "",
                              receiptCount: order.receipts.length,
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  meta,
  emphasis = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  meta?: string;
  emphasis?: boolean;
}) {
  return (
    <Card className={emphasis ? "border-amber-500/30 bg-amber-500/5" : undefined}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <div className="mt-3 text-xl font-semibold tracking-tight [overflow-wrap:anywhere]">{value}</div>
        {meta ? <div className="mt-1 text-xs text-muted-foreground">{meta}</div> : null}
      </CardContent>
    </Card>
  );
}
