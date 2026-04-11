import Link from "next/link";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";

import { VendorCreatePage } from "./vendor-create-page";

export default function NewVendorPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <PageHeader
        eyebrow="Purchases / Vendors"
        title="New vendor"
        description="Add a payable counterparty with compliance and payment details in one flow."
        actions={
          <Button asChild variant="outline">
            <Link href="/app/vendors">Back to vendors</Link>
          </Button>
        }
      />
      <VendorCreatePage />
    </div>
  );
}
