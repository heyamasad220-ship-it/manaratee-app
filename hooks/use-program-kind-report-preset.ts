"use client"

import { useCallback } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import {
  parseProgramKindReportFilter,
  PROGRAM_KIND_REPORT_QUERY_KEY,
  type ProgramKindReportFilter,
} from "@/lib/programs/program-kind-report-preset"

/**
 * URL-synced Academic/Seasonal Type filter for Programs reports (`?kind=`).
 * Survives report-tab navigation when nav links preserve the query.
 */
export function useProgramKindReportPreset(): {
  kindFilter: ProgramKindReportFilter
  setKindFilter: (next: ProgramKindReportFilter) => void
} {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const kindFilter = parseProgramKindReportFilter(
    searchParams.get(PROGRAM_KIND_REPORT_QUERY_KEY)
  )

  const setKindFilter = useCallback(
    (next: ProgramKindReportFilter) => {
      const params = new URLSearchParams(searchParams.toString())
      if (next === "all") {
        params.delete(PROGRAM_KIND_REPORT_QUERY_KEY)
      } else {
        params.set(PROGRAM_KIND_REPORT_QUERY_KEY, next)
      }
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      })
    },
    [pathname, router, searchParams]
  )

  return { kindFilter, setKindFilter }
}
