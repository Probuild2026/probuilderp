import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { approvalStatusDescriptions, approvalStatusLabels, approvalStatusValues } from "@/lib/approval-status";

export function ApprovalStatusGuide() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How to Use Review Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <div>Use review status so everyone knows whether an entry is still being prepared, waiting for review, or safe to rely on.</div>
        {approvalStatusValues.map((status) => (
          <div key={status}>
            <span className="font-medium text-foreground">{approvalStatusLabels[status]}:</span> {approvalStatusDescriptions[status]}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
