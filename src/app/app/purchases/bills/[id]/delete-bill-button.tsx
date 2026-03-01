"use client";

import { Button } from "@/components/ui/button";

export function DeleteBillButton({
  disabled,
  action,
}: {
  disabled: boolean;
  action: () => Promise<void>;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (disabled) return;
        const ok = window.confirm(
          "Delete this bill?\n\nThis will permanently delete the bill. You cannot delete a bill once payments are applied.",
        );
        if (!ok) e.preventDefault();
      }}
    >
      <Button
        variant="destructive"
        type="submit"
        disabled={disabled}
        title={disabled ? "Delete is disabled because payments are applied." : ""}
      >
        Delete
      </Button>
    </form>
  );
}

