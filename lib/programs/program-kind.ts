/** Academic year (multi-offering) vs seasonal camp/season product modes. */
export type ProgramKind = "academic" | "seasonal"

export const PROGRAM_KIND_LABELS: Record<ProgramKind, string> = {
  academic: "Academic Programs",
  seasonal: "Seasonal Programs",
}

export const PROGRAM_KIND_DESCRIPTIONS: Record<ProgramKind, string> = {
  academic:
    "School-year style: a year container with multiple offerings (courses, levels, tracks). Monthly and semester billing. Full-program registration — no day passes or à-la-carte sessions.",
  seasonal:
    "Camp/season style: a season with one or more programs (age/gender bands). Sessions, weeks, day passes, and package pricing. No monthly academic tuition.",
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

export function isAcademicProgramKind(
  value: string | null | undefined
): boolean {
  return normalizeProgramKind(value) === "academic"
}
