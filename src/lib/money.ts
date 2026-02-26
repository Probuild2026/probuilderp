export function parseMoney(value: unknown) {
  if (typeof value !== "string") return 0;
  const cleaned = value
    .replaceAll("₹", "")
    .replaceAll(",", "")
    .replaceAll(" ", "")
    .trim();
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function parsePercent(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.replaceAll("%", "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

