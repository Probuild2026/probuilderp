"use client";

import { useRouter } from "next/navigation";

import { ClientDialog } from "../client-dialog";

export function ClientCreatePage() {
  const router = useRouter();

  return (
    <ClientDialog
      defaultOpen
      hideTrigger
      onOpenChange={(open) => {
        if (!open) router.replace("/app/clients");
      }}
    />
  );
}
