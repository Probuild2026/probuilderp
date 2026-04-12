import { PageLoadingSkeleton } from "@/components/app/loading-panels";

export default function WagesLoading() {
  return <PageLoadingSkeleton tableColumns={8} tableRows={5} />;
}
