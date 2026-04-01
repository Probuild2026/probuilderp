"use client";

import { type ApprovalStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateApprovalStatus } from "@/app/actions/approval-status";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { approvalStatusDescriptions, approvalStatusLabels, approvalStatusValues } from "@/lib/approval-status";

type ApprovalTarget = "bill" | "expense" | "wage" | "payment" | "receipt";

export function ApprovalStatusControl({
  target,
  id,
  status,
  showHelp = false,
}: {
  target: ApprovalTarget;
  id: string;
  status: ApprovalStatus;
  showHelp?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState<ApprovalStatus>(status);

  function onValueChange(next: string) {
    const nextStatus = next as ApprovalStatus;
    const previous = value;
    setValue(nextStatus);

    startTransition(async () => {
      const result = await updateApprovalStatus({ target, id, status: nextStatus });
      if (!result.ok) {
        setValue(previous);
        toast.error(result.error.message);
        return;
      }

      toast.success(`Status changed to ${approvalStatusLabels[nextStatus]}.`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Select value={value} onValueChange={onValueChange} disabled={pending}>
        <SelectTrigger className="w-full sm:w-[220px]">
          <SelectValue placeholder="Select status" />
        </SelectTrigger>
        <SelectContent>
          {approvalStatusValues.map((option) => (
            <SelectItem key={option} value={option}>
              {approvalStatusLabels[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showHelp ? <div className="text-xs text-muted-foreground">{approvalStatusDescriptions[value]}</div> : null}
    </div>
  );
}
