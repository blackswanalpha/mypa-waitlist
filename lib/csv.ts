/** Minimal CSV builder with RFC-4180 quoting (commas, quotes, newlines). */
export function toCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][],
): string {
  const esc = (value: string | number | null | undefined): string => {
    const s = value == null ? "" : String(value);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows]
    .map((row) => row.map(esc).join(","))
    .join("\r\n");
}

/** Trigger a client-side download of a CSV string. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
