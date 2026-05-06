"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { deleteItem } from "./actions";

export function DeleteItemButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this item? It may be referenced by invoices/stock.")) return;
        startTransition(async () => {
          try {
            await deleteItem(id);
            toast.success("Item deleted.");
            router.refresh();
          } catch (e) {
            toast.error("Failed to delete item (it may be referenced).");
            console.error(e);
          }
        });
      }}
    >
      Delete
    </Button>
  );
}
