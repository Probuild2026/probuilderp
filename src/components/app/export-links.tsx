import { Button } from "@/components/ui/button";

type ExportLinksProps = {
  hrefBase: string;
  params?: Record<string, string | undefined>;
};

function buildHref(hrefBase: string, format: "csv" | "xlsx" | "pdf", params?: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (!value) continue;
    search.set(key, value);
  }
  search.set("format", format);

  const qs = search.toString();
  return qs ? `${hrefBase}?${qs}` : `${hrefBase}?format=${format}`;
}

export function ExportLinks({ hrefBase, params }: ExportLinksProps) {
  return (
    <>
      <Button asChild size="sm" variant="outline">
        <a href={buildHref(hrefBase, "csv", params)}>CSV</a>
      </Button>
      <Button asChild size="sm" variant="outline">
        <a href={buildHref(hrefBase, "xlsx", params)}>Excel</a>
      </Button>
      <Button asChild size="sm" variant="outline">
        <a href={buildHref(hrefBase, "pdf", params)}>PDF</a>
      </Button>
    </>
  );
}
