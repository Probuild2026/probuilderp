import { PageLoadingSkeleton } from "@/components/app/loading-panels";

export default function AppLoading() {
  return <PageLoadingSkeleton tableColumns={7} tableRows={4} />;
}
