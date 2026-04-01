import { type ApprovalStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { approvalStatusBadgeVariant, approvalStatusLabels } from "@/lib/approval-status";

export function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  return <Badge variant={approvalStatusBadgeVariant(status)}>{approvalStatusLabels[status]}</Badge>;
}
