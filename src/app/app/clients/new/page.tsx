import Link from "next/link";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";

import { ClientCreatePage } from "./client-create-page";

export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <PageHeader
        eyebrow="Sales / Clients"
        title="New client"
        description="Create a client record without leaving the master-data workflow."
        actions={
          <Button asChild variant="outline">
            <Link href="/app/clients">Back to clients</Link>
          </Button>
        }
      />
      <ClientCreatePage />
    </div>
  );
}
