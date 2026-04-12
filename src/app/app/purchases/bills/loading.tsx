import { PageLoadingSkeleton } from "@/components/app/loading-panels";

export default function BillsLoading() {
  return <PageLoadingSkeleton tableColumns={10} tableRows={6} />;
}
