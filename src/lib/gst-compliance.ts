export function normalizeGstin(value?: string | null) {
  return value?.trim().toUpperCase() ?? "";
}

export function isLikelyValidGstin(value?: string | null) {
  const gstin = normalizeGstin(value);
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin);
}
