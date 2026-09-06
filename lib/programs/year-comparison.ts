import type { ProgramKind } from "@/lib/programs/program-kind"

const SERIES_ALIASES: Record<string, string> = {
  qlh: "Quran for Little Hearts",
  qil: "Quran Institute for Ladies",
  "summer camp 1": "Summer Camp",
  "summer camp 2": "Summer Camp",
  "fall camp october": "Fall Camp",
  "fall camp november": "Fall Camp",
  "spring camp week 1": "Spring Camp",
  "spring camp week 2": "Spring Camp",
  "winter break camp": "Winter Camp",
  "winter camp ready set pray": "Winter Camp",
}

/** Compact labels for department Programs KPI cards. Unlisted series keep their parsed name. */
const SERIES_SHORT_ALIASES: Record<string, string> = {
  "kids saturday quranic arabic": "Kids SQA",
  "saturday quranic arabic": "SQA",
  "quran institute junior": "QIJ",
  qlh: "QLH",
  "quran 4 little hearts": "QLH",
  "quran for little hearts": "QLH",
  qil: "QIL",
}

const ACADEMIC_YEAR_IN_NAME =
  /^(.+?)\s+(\d{4})\s*[-–/]\s*(\d{2}|\d{4})$/
const CALENDAR_YEAR_IN_NAME = /^(.+?)\s+(\d{4})$/

export type YearComparisonFact = {
  departmentId: string
  departmentName: string
  seriesKey: string
  seriesLabel: string
  yearKey: string
  yearLabel: string
  sortYear: number
  programId: string
  programKind: ProgramKind
  familyId: string
  kidId: string
}

export type YearComparisonYearRow = {
  yearKey: string
  yearLabel: string
  sortYear: number
  programId: string | null
  kids: number
  families: number
  newFamilies: number
  returningFamilies: number
  droppedFamilies: number
  newKids: number
  returningKids: number
  droppedKids: number
  kidsPerFamily: number | null
  kidsChangePct: number | null
  familiesChangePct: number | null
}

export type YearComparisonSeriesRow = {
  seriesKey: string
  seriesLabel: string
  departmentId: string
  departmentName: string
} & Omit<YearComparisonYearRow, "yearKey" | "yearLabel" | "sortYear">

export type ParsedProgramYear = {
  seriesRaw: string
  seriesLabel: string
  yearKey: string
  yearLabel: string
  sortYear: number
}

export function expandAcademicEndYear(startYear: number, endToken: string) {
  if (endToken.length === 4) return Number(endToken)
  return Number(`${String(startYear).slice(0, 2)}${endToken}`)
}

export function formatYearLabel(yearKey: string) {
  const academic = /^(\d{4})-(\d{4})$/.exec(yearKey)
  if (academic) return `${academic[1]}–${academic[2]}`
  return yearKey
}

export function previousYearKey(yearKey: string): string | null {
  const academic = /^(\d{4})-(\d{4})$/.exec(yearKey)
  if (academic) {
    const start = Number(academic[1])
    return `${start - 1}-${start}`
  }
  const calendar = /^(\d{4})$/.exec(yearKey)
  if (calendar) return String(Number(calendar[1]) - 1)
  return null
}

export function seriesLabelFromRaw(raw: string) {
  const trimmed = raw.trim()
  const alias = SERIES_ALIASES[trimmed.toLowerCase()]
  return alias || trimmed
}

export function seriesShortLabelFromRaw(raw: string) {
  const canonical = seriesLabelFromRaw(raw)
  const alias =
    SERIES_SHORT_ALIASES[canonical.toLowerCase()] ||
    SERIES_SHORT_ALIASES[raw.trim().toLowerCase()]
  return alias || canonical
}

export type ProgramSeriesSummary = {
  seriesKey: string
  seriesRaw: string
  shortLabel: string
  activeCount: number
  closedCount: number
}

export function programSeriesKey(
  departmentId: string,
  name: string,
  startDate?: string | null
) {
  const parsed = parseProgramSeriesAndYear(name, startDate)
  return makeSeriesKey(departmentId, parsed.seriesRaw)
}

/** Active and closed year counts per series. Draft, paused, and archived years are omitted. */
export function buildProgramSeriesSummaries(
  programs: Array<{
    name: string
    status: string
    startDate?: string | null
  }>,
  departmentId: string,
  options?: { minPrograms?: number }
): ProgramSeriesSummary[] {
  const minPrograms = options?.minPrograms ?? 1
  const byKey = new Map<string, ProgramSeriesSummary>()
  for (const program of programs) {
    if (program.status !== "active" && program.status !== "closed") continue
    const parsed = parseProgramSeriesAndYear(program.name, program.startDate)
    const seriesKey = makeSeriesKey(departmentId, parsed.seriesRaw)
    let row = byKey.get(seriesKey)
    if (!row) {
      row = {
        seriesKey,
        seriesRaw: parsed.seriesLabel,
        shortLabel: seriesShortLabelFromRaw(parsed.seriesLabel),
        activeCount: 0,
        closedCount: 0,
      }
      byKey.set(seriesKey, row)
    }
    if (program.status === "active") row.activeCount += 1
    else row.closedCount += 1
  }
  return [...byKey.values()]
    .filter((row) => row.activeCount + row.closedCount >= minPrograms)
    .sort((a, b) =>
      a.shortLabel.localeCompare(b.shortLabel, undefined, { sensitivity: "base" })
    )
}

export function parseProgramSeriesAndYear(
  name: string,
  startDate?: string | null
): ParsedProgramYear {
  const trimmed = String(name || "").trim()
  const academic = ACADEMIC_YEAR_IN_NAME.exec(trimmed)
  if (academic) {
    const startYear = Number(academic[2])
    const endYear = expandAcademicEndYear(startYear, academic[3])
    const yearKey = `${startYear}-${endYear}`
    const seriesRaw = academic[1].trim()
    return {
      seriesRaw,
      seriesLabel: seriesLabelFromRaw(seriesRaw),
      yearKey,
      yearLabel: formatYearLabel(yearKey),
      sortYear: startYear,
    }
  }

  const calendar = CALENDAR_YEAR_IN_NAME.exec(trimmed)
  if (calendar) {
    const year = calendar[2]
    const seriesRaw = calendar[1].trim()
    return {
      seriesRaw,
      seriesLabel: seriesLabelFromRaw(seriesRaw),
      yearKey: year,
      yearLabel: year,
      sortYear: Number(year),
    }
  }

  const inferred = inferYearFromStartDate(startDate)
  const seriesRaw = trimmed || "Program"
  return {
    seriesRaw,
    seriesLabel: seriesLabelFromRaw(seriesRaw),
    yearKey: inferred.yearKey,
    yearLabel: inferred.yearLabel,
    sortYear: inferred.sortYear,
  }
}

function inferYearFromStartDate(startDate?: string | null): {
  yearKey: string
  yearLabel: string
  sortYear: number
} {
  const iso = String(startDate || "").slice(0, 10)
  const match = /^(\d{4})-(\d{2})/.exec(iso)
  if (!match) {
    return { yearKey: "unknown", yearLabel: "Unknown", sortYear: 0 }
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const startYear = month >= 7 ? year : year - 1
  const yearKey = `${startYear}-${startYear + 1}`
  return {
    yearKey,
    yearLabel: formatYearLabel(yearKey),
    sortYear: startYear,
  }
}

export function makeSeriesKey(departmentId: string, seriesRaw: string) {
  return `${departmentId}::${seriesLabelFromRaw(seriesRaw).trim().toLowerCase()}`
}

export function percentChange(current: number, previous: number | null): number | null {
  if (previous == null || previous === 0) return null
  return ((current - previous) / previous) * 100
}

type YearBucket = {
  yearKey: string
  yearLabel: string
  sortYear: number
  kids: Set<string>
  families: Set<string>
  programIdCounts: Map<string, number>
}

function emptyBucket(
  yearKey: string,
  yearLabel: string,
  sortYear: number
): YearBucket {
  return {
    yearKey,
    yearLabel,
    sortYear,
    kids: new Set(),
    families: new Set(),
    programIdCounts: new Map(),
  }
}

export function preferredProgramId(
  programIdCounts: Iterable<[string, number]> | Map<string, number>
): string | null {
  const entries = [...programIdCounts].filter(([id, count]) => id && count > 0)
  if (entries.length === 0) return null
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  return entries[0]![0]
}

function metricsFromBuckets(
  current: YearBucket,
  previous: YearBucket | undefined
): YearComparisonYearRow {
  const prevFamilies = previous?.families ?? new Set<string>()
  const prevKids = previous?.kids ?? new Set<string>()
  let returningFamilies = 0
  let newFamilies = 0
  for (const id of current.families) {
    if (prevFamilies.has(id)) returningFamilies += 1
    else newFamilies += 1
  }
  let droppedFamilies = 0
  for (const id of prevFamilies) {
    if (!current.families.has(id)) droppedFamilies += 1
  }
  let returningKids = 0
  let newKids = 0
  for (const id of current.kids) {
    if (prevKids.has(id)) returningKids += 1
    else newKids += 1
  }
  let droppedKids = 0
  for (const id of prevKids) {
    if (!current.kids.has(id)) droppedKids += 1
  }
  const kids = current.kids.size
  const families = current.families.size
  const prevKidCount = previous ? previous.kids.size : null
  const prevFamilyCount = previous ? previous.families.size : null
  return {
    yearKey: current.yearKey,
    yearLabel: current.yearLabel,
    sortYear: current.sortYear,
    programId: preferredProgramId(current.programIdCounts),
    kids,
    families,
    newFamilies,
    returningFamilies,
    droppedFamilies: previous ? droppedFamilies : 0,
    newKids,
    returningKids,
    droppedKids: previous ? droppedKids : 0,
    kidsPerFamily: families > 0 ? kids / families : null,
    kidsChangePct: percentChange(kids, prevKidCount),
    familiesChangePct: percentChange(families, prevFamilyCount),
  }
}

export function buildYearRows(facts: YearComparisonFact[]): YearComparisonYearRow[] {
  const byYear = new Map<string, YearBucket>()
  for (const fact of facts) {
    let bucket = byYear.get(fact.yearKey)
    if (!bucket) {
      bucket = emptyBucket(fact.yearKey, fact.yearLabel, fact.sortYear)
      byYear.set(fact.yearKey, bucket)
    }
    bucket.kids.add(fact.kidId)
    bucket.families.add(fact.familyId)
    bucket.programIdCounts.set(
      fact.programId,
      (bucket.programIdCounts.get(fact.programId) || 0) + 1
    )
  }

  return [...byYear.values()]
    .sort((a, b) => a.sortYear - b.sortYear || a.yearKey.localeCompare(b.yearKey))
    .map((bucket) => {
      const prevKey = previousYearKey(bucket.yearKey)
      const previous = prevKey ? byYear.get(prevKey) : undefined
      return metricsFromBuckets(bucket, previous)
    })
}

export function buildSeriesBreakdown(
  facts: YearComparisonFact[],
  yearKey: string
): YearComparisonSeriesRow[] {
  const thisYear = facts.filter((fact) => fact.yearKey === yearKey)
  const prevKey = previousYearKey(yearKey)
  const prevYear = prevKey
    ? facts.filter((fact) => fact.yearKey === prevKey)
    : []

  const seriesMeta = new Map<
    string,
    { seriesLabel: string; departmentId: string; departmentName: string }
  >()
  const currentBySeries = new Map<string, YearBucket>()
  const previousBySeries = new Map<string, YearBucket>()

  for (const fact of thisYear) {
    seriesMeta.set(fact.seriesKey, {
      seriesLabel: fact.seriesLabel,
      departmentId: fact.departmentId,
      departmentName: fact.departmentName,
    })
    let bucket = currentBySeries.get(fact.seriesKey)
    if (!bucket) {
      bucket = emptyBucket(yearKey, fact.yearLabel, fact.sortYear)
      currentBySeries.set(fact.seriesKey, bucket)
    }
    bucket.kids.add(fact.kidId)
    bucket.families.add(fact.familyId)
    bucket.programIdCounts.set(
      fact.programId,
      (bucket.programIdCounts.get(fact.programId) || 0) + 1
    )
  }

  for (const fact of prevYear) {
    let bucket = previousBySeries.get(fact.seriesKey)
    if (!bucket) {
      bucket = emptyBucket(fact.yearKey, fact.yearLabel, fact.sortYear)
      previousBySeries.set(fact.seriesKey, bucket)
    }
    bucket.kids.add(fact.kidId)
    bucket.families.add(fact.familyId)
  }

  return [...currentBySeries.entries()]
    .map(([seriesKey, bucket]) => {
      const meta = seriesMeta.get(seriesKey)!
      const metrics = metricsFromBuckets(bucket, previousBySeries.get(seriesKey))
      return {
        seriesKey,
        seriesLabel: meta.seriesLabel,
        departmentId: meta.departmentId,
        departmentName: meta.departmentName,
        programId: metrics.programId,
        kids: metrics.kids,
        families: metrics.families,
        newFamilies: metrics.newFamilies,
        returningFamilies: metrics.returningFamilies,
        droppedFamilies: metrics.droppedFamilies,
        newKids: metrics.newKids,
        returningKids: metrics.returningKids,
        droppedKids: metrics.droppedKids,
        kidsPerFamily: metrics.kidsPerFamily,
        kidsChangePct: metrics.kidsChangePct,
        familiesChangePct: metrics.familiesChangePct,
      }
    })
    .sort((a, b) => b.kids - a.kids || a.seriesLabel.localeCompare(b.seriesLabel))
}

export function filterYearComparisonFacts(
  facts: YearComparisonFact[],
  filters: {
    departmentId?: string | null
    seriesKey?: string | null
    programKind?: ProgramKind | "all" | null
  }
) {
  const departmentId = filters.departmentId || null
  const seriesKey = filters.seriesKey || null
  const programKind = filters.programKind || "all"
  return facts.filter((fact) => {
    if (departmentId && fact.departmentId !== departmentId) return false
    if (seriesKey && fact.seriesKey !== seriesKey) return false
    if (programKind !== "all" && fact.programKind !== programKind) return false
    return true
  })
}

export function formatPct(value: number | null) {
  if (value == null || Number.isNaN(value)) return "—"
  const rounded = Math.round(value * 10) / 10
  const sign = rounded > 0 ? "+" : ""
  return `${sign}${rounded}%`
}

export function formatKidsPerFamily(value: number | null) {
  if (value == null || Number.isNaN(value)) return "—"
  return value.toFixed(1)
}
