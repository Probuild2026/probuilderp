import { type ApprovalStatus } from "@prisma/client";

export const approvalStatusValues = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "CANCELLED"] as const satisfies readonly ApprovalStatus[];

export const approvalStatusLabels: Record<ApprovalStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending Approval",
  APPROVED: "Approved",
  CANCELLED: "Cancelled",
};

export const approvalStatusDescriptions: Record<ApprovalStatus, string> = {
  DRAFT: "Saved, but still being prepared. Use this when the entry is not final yet.",
  PENDING_APPROVAL: "Entered and waiting for someone to review it before relying on it.",
  APPROVED: "Checked and okay for the team to rely on as the final version.",
  CANCELLED: "Keep the history, but treat this entry as void and do not act on it further.",
};

export function parseApprovalStatus(value?: string | null): ApprovalStatus | undefined {
  const normalized = (value ?? "").trim();
  return approvalStatusValues.includes(normalized as ApprovalStatus) ? (normalized as ApprovalStatus) : undefined;
}

export function approvalStatusBadgeVariant(status: ApprovalStatus): "default" | "secondary" | "outline" | "destructive" {
  if (status === "APPROVED") return "default";
  if (status === "PENDING_APPROVAL") return "secondary";
  if (status === "CANCELLED") return "destructive";
  return "outline";
}
