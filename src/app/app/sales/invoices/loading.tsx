import { PageLoadingSkeleton } from "@/components/app/loading-panels";

export default function InvoicesLoading() {
  return <PageLoadingSkeleton tableColumns={11} tableRows={6} />;
}
