/** Academic year (QIL-style) vs seasonal camp (single product, no offerings chrome). */
export type ProgramKind = "academic" | "seasonal"

export const PROGRAM_KIND_LABELS: Record<ProgramKind, string> = {
  academic: "Academic Year",
  seasonal: "Seasonal",
}

export const PROGRAM_KIND_DESCRIPTIONS: Record<ProgramKind, string> = {
  academic:
    "A year or season with multiple programs (classes, levels, tracks). Example: Qur’an Institute 2026–2027.",
  seasonal:
    "One camp or season product with weeks/sessions, pricing, and capacity on this page. Example: Summer Camp 2026. No separate offerings layer.",
}

export function normalizeProgramKind(
  value: string | null | undefined
): ProgramKind {
  return value === "seasonal" ? "seasonal" : "academic"
}

export function isSeasonalProgramKind(
  value: string | null | undefined
): boolean {
  return normalizeProgramKind(value) === "seasonal"
}
