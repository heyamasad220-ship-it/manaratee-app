/** Base booth price plus extra charged when a vendor picks a numbered table. */
export function boothSelectionTotal(price: number | null | undefined, selectionFee: number | null | undefined) {
  const base = Math.max(0, Number(price) || 0)
  const extra = Math.max(0, Number(selectionFee) || 0)
  return Math.round((base + extra) * 100) / 100
}

export function parseBoothNumberList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean)
  }
  if (typeof value !== "string") return []
  return value
    .split(/[,;\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}
