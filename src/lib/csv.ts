function splitCsvLine(line: string) {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseCsv(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const headerIndex = lines.findIndex((l) => splitCsvLine(l)[0]?.toLowerCase() === "stage");
  if (headerIndex === -1) throw new Error("CSV header row not found (expected first column 'Stage').");

  const header = splitCsvLine(lines[headerIndex]).map((h) => h.toLowerCase());
  const rows: Array<Record<string, string>> = [];
  for (const line of lines.slice(headerIndex + 1)) {
    const cols = splitCsvLine(line);
    if (!cols[0]) continue;
    if (cols[0].toLowerCase() === "totals") continue;
    const row: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) row[header[i]] = cols[i] ?? "";
    rows.push(row);
  }
  return rows;
}

