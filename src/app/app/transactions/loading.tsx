import { PageLoadingSkeleton } from "@/components/app/loading-panels";

export default function TransactionsLoading() {
  return <PageLoadingSkeleton tableColumns={8} tableRows={6} />;
}
