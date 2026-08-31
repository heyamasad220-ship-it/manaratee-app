"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"

import { YearComparisonReport } from "@/components/programs/year-comparison-report"
import {
  makeSeriesKey,
  parseProgramSeriesAndYear,
  type YearComparisonFact,
} from "@/lib/programs/year-comparison"
import { getYearComparisonFacts } from "@/lib/programs/year-comparison-queries"

export function ProgramYearComparisonPanel({
  programName,
  departmentId,
  startDate,
}: {
  programName: string
  departmentId: string
  startDate: string | null
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [facts, setFacts] = useState<YearComparisonFact[]>([])

  const parsed = useMemo(
    () => parseProgramSeriesAndYear(programName, startDate),
    [programName, startDate]
  )
  const seriesKey = useMemo(
    () => makeSeriesKey(departmentId, parsed.seriesRaw),
    [departmentId, parsed.seriesRaw]
  )

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const result = await getYearComparisonFacts()
      if (cancelled) return
      if (!result.success) {
        setError(result.error)
        setFacts([])
      } else {
        setFacts(result.facts)
      }
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border py-12 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading year comparison…
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Participants, families, and new vs returning for {parsed.seriesLabel}{" "}
        across years. Open a year to go to that program workspace.
      </p>
      <YearComparisonReport
        facts={facts}
        lockedSeriesKey={seriesKey}
        lockedDepartmentId={departmentId}
        initialYearKey={parsed.yearKey}
      />
    </div>
  )
}
