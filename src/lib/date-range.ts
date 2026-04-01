type SearchParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function readParam(source: SearchParamSource, key: string) {
  if (source instanceof URLSearchParams) return source.get(key) ?? "";
  const value = source[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function getSingleSearchParam(source: SearchParamSource, key: string) {
  return readParam(source, key).trim();
}

export function parseDateRangeParams(source: SearchParamSource) {
  return {
    from: getSingleSearchParam(source, "from"),
    to: getSingleSearchParam(source, "to"),
  };
}

export function startOfDayUtc(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export function endOfDayUtc(value: string) {
  return new Date(`${value}T23:59:59.999Z`);
}

export function buildInclusiveDateRange(from?: string, to?: string) {
  if (!from && !to) return undefined;

  return {
    ...(from ? { gte: startOfDayUtc(from) } : {}),
    ...(to ? { lte: endOfDayUtc(to) } : {}),
  };
}

export function buildMonthInterval(month: string) {
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end };
}

export function formatMonthLabel(month: string) {
  const { start } = buildMonthInterval(month);
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(start);
}
