import type { ProgramKind } from "@/lib/programs/program-kind"

/** URL query key for Academic/Seasonal report Type presets. */
export const PROGRAM_KIND_REPORT_QUERY_KEY = "kind"

export type ProgramKindReportFilter = "all" | ProgramKind

export function parseProgramKindReportFilter(
  value: string | null | undefined
): ProgramKindReportFilter {
  if (value === "academic" || value === "seasonal") return value
  return "all"
}

/**
 * Merge (or clear) the kind preset on a path that may already have a query string
 * (e.g. `/programs/reports?tab=waitlist`).
 */
export function withProgramKindReportQuery(
  href: string,
  kindFilter: ProgramKindReportFilter
): string {
  const question = href.indexOf("?")
  const path = question >= 0 ? href.slice(0, question) : href
  const query = question >= 0 ? href.slice(question + 1) : ""
  const params = new URLSearchParams(query)
  if (kindFilter === "all") {
    params.delete(PROGRAM_KIND_REPORT_QUERY_KEY)
  } else {
    params.set(PROGRAM_KIND_REPORT_QUERY_KEY, kindFilter)
  }
  const next = params.toString()
  return next ? `${path}?${next}` : path
}
