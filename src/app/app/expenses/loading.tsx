import { PageLoadingSkeleton } from "@/components/app/loading-panels";

export default function ExpensesLoading() {
  return <PageLoadingSkeleton tableColumns={10} tableRows={6} />;
}
