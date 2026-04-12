import { PageLoadingSkeleton } from "@/components/app/loading-panels";

export default function ReceiptsLoading() {
  return <PageLoadingSkeleton tableColumns={9} tableRows={6} />;
}
