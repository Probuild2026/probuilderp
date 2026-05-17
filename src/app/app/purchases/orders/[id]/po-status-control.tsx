"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updatePurchaseOrderStatus } from "@/app/actions/purchase-orders";

type Status = "DRAFT" | "SENT" | "PARTIALLY_BILLED" | "FULLY_BILLED" | "CANCELLED";

const TRANSITIONS: Record<Status, Status[]> = {
  DRAFT: ["SENT", "CANCELLED"],
  SENT: ["PARTIALLY_BILLED", "FULLY_BILLED", "CANCELLED"],
  PARTIALLY_BILLED: ["FULLY_BILLED", "CANCELLED"],
  FULLY_BILLED: [],
  CANCELLED: [],
};

const STATUS_LABELS: Record<Status, string> = {
  DRAFT: "Draft",
  SENT: "Sent to Vendor",
  PARTIALLY_BILLED: "Partially Billed",
  FULLY_BILLED: "Fully Billed",
  CANCELLED: "Cancelled",
};

export function PoStatusControl({ orderId, currentStatus }: { orderId: string; currentStatus: string }) {
  const status = currentStatus as Status;
  const [current, setCurrent] = useState(status);
  const [saving, setSaving] = useState(false);
  const next = TRANSITIONS[current] ?? [];

  async function advance(s: Status) {
    setSaving(true);
    const result = await updatePurchaseOrderStatus({ id: orderId, status: s });
    setSaving(false);
    if (result.ok) setCurrent(s);
  }

  return (
    <Card>
      <CardHeader className="border-b border-border/60">
        <CardTitle className="text-base">PO status</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3 pt-4">
        <Badge variant="outline">{STATUS_LABELS[current]}</Badge>
        {next.map((s) => (
          <Button key={s} size="sm" variant="secondary" disabled={saving} onClick={() => advance(s)}>
            Mark as {STATUS_LABELS[s]}
          </Button>
        ))}
        {next.length === 0 ? <span className="text-sm text-muted-foreground">No further transitions available.</span> : null}
      </CardContent>
    </Card>
  );
}
