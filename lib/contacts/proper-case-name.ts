/**
 * Title-case a person name for display/storage.
 * Examples: "ABEER ZOUBI" → "Abeer Zoubi", "mary-jane o'brien" → "Mary-Jane O'Brien"
 */
export function toProperPersonName(value: string | null | undefined): string {
  const trimmed = String(value ?? "").trim().replace(/\s+/g, " ")
  if (!trimmed) return ""

  return trimmed
    .split(" ")
    .map((word) => properCaseWord(word))
    .join(" ")
}

/**
 * True when a name is ALL CAPS or all lowercase (common import artifacts).
 * Mixed-case names like "Abeer Zoubi" or "McDonald" are left alone.
 */
export function shouldProperCasePersonName(value: string | null | undefined): boolean {
  const trimmed = String(value ?? "").trim()
  if (!trimmed) return false

  const letters = trimmed.replace(/[^A-Za-z]/g, "")
  if (letters.length < 2) return false

  const upper = letters.toUpperCase()
  const lower = letters.toLowerCase()
  return letters === upper || letters === lower
}

export function properCasePersonNameIfNeeded(value: string | null | undefined): string {
  const trimmed = String(value ?? "").trim().replace(/\s+/g, " ")
  if (!trimmed) return ""
  if (!shouldProperCasePersonName(trimmed)) return trimmed
  return toProperPersonName(trimmed)
}

function properCaseWord(word: string): string {
  if (!word) return word

  // Keep hyphenated parts independent: MARY-JANE → Mary-Jane
  if (word.includes("-")) {
    return word
      .split("-")
      .map((part) => properCaseWord(part))
      .join("-")
  }

  // O'BRIEN / D'ANGELO style
  const apostropheMatch = word.match(/^([A-Za-z]+)'([A-Za-z]+)$/)
  if (apostropheMatch) {
    return `${capitalizeSegment(apostropheMatch[1])}'${capitalizeSegment(apostropheMatch[2])}`
  }

  return capitalizeSegment(word)
}

function capitalizeSegment(segment: string): string {
  if (!segment) return segment
  const lower = segment.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}
