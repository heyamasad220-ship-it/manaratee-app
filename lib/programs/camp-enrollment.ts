export const CAMP_DEPARTMENT_NAME = "Recreational Camps"
export const SUMMER_CAMP_2026_NAME = "Summer Camp 2026"
export const SUMMER_CAMP_2_2026_START = "2026-06-29"

export type CampSeason = "Fall" | "Spring" | "Summer" | "Winter" | "Specialty"

export type CampParticipationFact = {
  familyId: string
  familyName: string
  email: string | null
  phone: string | null
  instanceKey: string
  programId: string
  programName: string
  season: CampSeason
  year: number
  startDate: string | null
  endDate: string | null
  enrollmentDate: string | null
  sortKey: string
}

export type CampProgramSummaryRow = {
  instanceKey: string
  programId: string
  programName: string
  season: CampSeason
  year: number
  startDate: string | null
  endDate: string | null
  families: number
  newFamilies: number
  returningFamilies: number
  droppedFamilies: number
}

export type CampTrendRow = {
  year: number
  Fall: number
  Spring: number
  Summer: number
  Winter: number
  Specialty: number
}

export type CampFamilyRow = {
  familyId: string
  familyName: string
  email: string | null
  phone: string | null
  programCount: number
  programs: string[]
  lastProgramName: string | null
  lastProgramDate: string | null
  lastProgramId: string | null
}

const SEASON_ORDER: Record<CampSeason, number> = {
  Spring: 1,
  Summer: 2,
  Fall: 3,
  Winter: 4,
  Specialty: 5,
}

export function isoDate(value: string | null | undefined) {
  const iso = String(value || "").slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null
}

export function parseCampYear(
  name: string,
  startDate?: string | null
): number {
  const matches = [...String(name || "").matchAll(/\b(20\d{2})\b/g)]
  if (matches.length > 0) {
    return Number(matches[matches.length - 1]![1])
  }
  const start = isoDate(startDate)
  if (start) return Number(start.slice(0, 4))
  return 0
}

export function parseCampSeason(name: string): CampSeason {
  const lower = String(name || "").toLowerCase()
  if (
    /overnight|rijaal|specialty/.test(lower) &&
    !/summer|fall|winter|spring/.test(lower)
  ) {
    return "Specialty"
  }
  if (/\bwinter\b/.test(lower)) return "Winter"
  if (/\bfall\b/.test(lower)) return "Fall"
  if (/\bspring\b|\bramadan\b/.test(lower)) return "Spring"
  if (/\bsummer\b|\byouth intensive\b|\bspecial needs\b/.test(lower)) {
    return "Summer"
  }
  if (/overnight|rijaal/.test(lower)) return "Specialty"
  return "Summer"
}

export function campSortKey(
  year: number,
  season: CampSeason,
  startDate: string | null,
  programName: string
) {
  const date = isoDate(startDate) || `${String(year).padStart(4, "0")}-${String(SEASON_ORDER[season]).padStart(2, "0")}-01`
  const campBand = /\bcamp\s*2\b|\bcamp two\b|\(july\)/i.test(programName)
    ? "2"
    : /\bcamp\s*1\b|\bcamp one\b/.test(programName)
      ? "1"
      : "0"
  return `${date}|${campBand}|${programName.toLowerCase()}`
}

export function parseCampMeta(
  name: string,
  startDate?: string | null,
  endDate?: string | null
) {
  const season = parseCampSeason(name)
  const year = parseCampYear(name, startDate)
  const start = isoDate(startDate)
  const end = isoDate(endDate)
  return {
    season,
    year,
    startDate: start,
    endDate: end,
    sortKey: campSortKey(year, season, start, name),
  }
}

export type SummerCamp2026Split = {
  camp1: boolean
  camp2: boolean
}

export function splitSummerCamp2026Sessions(
  sessionStartDates: Array<string | null | undefined>
): SummerCamp2026Split {
  let camp1 = false
  let camp2 = false
  for (const value of sessionStartDates) {
    const start = isoDate(value)
    if (!start) continue
    if (start < SUMMER_CAMP_2_2026_START) camp1 = true
    else camp2 = true
  }
  return { camp1, camp2 }
}

export function summerCamp2026Instances(
  programId: string,
  split: SummerCamp2026Split
): Array<{
  instanceKey: string
  programName: string
  startDate: string
  endDate: string
}> {
  const instances = []
  if (split.camp1) {
    instances.push({
      instanceKey: `${programId}:camp1`,
      programName: "Summer Camp 1 2026",
      startDate: "2026-06-01",
      endDate: "2026-06-25",
    })
  }
  if (split.camp2) {
    instances.push({
      instanceKey: `${programId}:camp2`,
      programName: "Summer Camp 2 2026",
      startDate: "2026-06-29",
      endDate: "2026-07-23",
    })
  }
  if (instances.length === 0) {
    instances.push({
      instanceKey: programId,
      programName: SUMMER_CAMP_2026_NAME,
      startDate: "2026-06-01",
      endDate: "2026-07-23",
    })
  }
  return instances
}

function instanceList(facts: CampParticipationFact[]) {
  const byKey = new Map<
    string,
    {
      instanceKey: string
      programId: string
      programName: string
      season: CampSeason
      year: number
      startDate: string | null
      endDate: string | null
      sortKey: string
      families: Set<string>
    }
  >()
  for (const fact of facts) {
    let row = byKey.get(fact.instanceKey)
    if (!row) {
      row = {
        instanceKey: fact.instanceKey,
        programId: fact.programId,
        programName: fact.programName,
        season: fact.season,
        year: fact.year,
        startDate: fact.startDate,
        endDate: fact.endDate,
        sortKey: fact.sortKey,
        families: new Set(),
      }
      byKey.set(fact.instanceKey, row)
    }
    row.families.add(fact.familyId)
  }
  return [...byKey.values()].sort(
    (a, b) => a.sortKey.localeCompare(b.sortKey) || a.programName.localeCompare(b.programName)
  )
}

export function buildCampProgramSummary(
  facts: CampParticipationFact[]
): CampProgramSummaryRow[] {
  const instances = instanceList(facts)
  return instances.map((current, index) => {
    const previous = index > 0 ? instances[index - 1] : undefined
    let returningFamilies = 0
    let newFamilies = 0
    for (const id of current.families) {
      if (previous?.families.has(id)) returningFamilies += 1
      else newFamilies += 1
    }
    let droppedFamilies = 0
    if (previous) {
      for (const id of previous.families) {
        if (!current.families.has(id)) droppedFamilies += 1
      }
    }
    return {
      instanceKey: current.instanceKey,
      programId: current.programId,
      programName: current.programName,
      season: current.season,
      year: current.year,
      startDate: current.startDate,
      endDate: current.endDate,
      families: current.families.size,
      newFamilies,
      returningFamilies,
      droppedFamilies,
    }
  })
}

export function buildCampTrend(facts: CampParticipationFact[]): CampTrendRow[] {
  const byYear = new Map<number, Map<CampSeason, Set<string>>>()
  for (const fact of facts) {
    if (!fact.year) continue
    let seasons = byYear.get(fact.year)
    if (!seasons) {
      seasons = new Map()
      byYear.set(fact.year, seasons)
    }
    let families = seasons.get(fact.season)
    if (!families) {
      families = new Set()
      seasons.set(fact.season, families)
    }
    families.add(fact.familyId)
  }
  return [...byYear.keys()]
    .sort((a, b) => a - b)
    .map((year) => {
      const seasons = byYear.get(year)!
      return {
        year,
        Fall: seasons.get("Fall")?.size || 0,
        Spring: seasons.get("Spring")?.size || 0,
        Summer: seasons.get("Summer")?.size || 0,
        Winter: seasons.get("Winter")?.size || 0,
        Specialty: seasons.get("Specialty")?.size || 0,
      }
    })
}

export function lastParticipationDate(fact: CampParticipationFact) {
  return isoDate(fact.endDate) || isoDate(fact.startDate) || isoDate(fact.enrollmentDate)
}

export function buildCampFamilyRows(
  facts: CampParticipationFact[]
): CampFamilyRow[] {
  const byFamily = new Map<
    string,
    {
      familyId: string
      familyName: string
      email: string | null
      phone: string | null
      programs: Map<string, CampParticipationFact>
    }
  >()
  for (const fact of facts) {
    let row = byFamily.get(fact.familyId)
    if (!row) {
      row = {
        familyId: fact.familyId,
        familyName: fact.familyName,
        email: fact.email,
        phone: fact.phone,
        programs: new Map(),
      }
      byFamily.set(fact.familyId, row)
    }
    if (!row.familyName && fact.familyName) row.familyName = fact.familyName
    if (!row.email && fact.email) row.email = fact.email
    if (!row.phone && fact.phone) row.phone = fact.phone
    const existing = row.programs.get(fact.instanceKey)
    if (!existing) {
      row.programs.set(fact.instanceKey, fact)
      continue
    }
    const nextDate = lastParticipationDate(fact)
    const prevDate = lastParticipationDate(existing)
    if (nextDate && (!prevDate || nextDate > prevDate)) {
      row.programs.set(fact.instanceKey, fact)
    }
  }

  return [...byFamily.values()]
    .map((row) => {
      const programs = [...row.programs.values()].sort(
        (a, b) =>
          a.sortKey.localeCompare(b.sortKey) ||
          a.programName.localeCompare(b.programName)
      )
      const last = [...programs].sort((a, b) => {
        const aDate = lastParticipationDate(a) || ""
        const bDate = lastParticipationDate(b) || ""
        return bDate.localeCompare(aDate) || b.sortKey.localeCompare(a.sortKey)
      })[0]
      return {
        familyId: row.familyId,
        familyName: row.familyName || "Family",
        email: row.email,
        phone: row.phone,
        programCount: programs.length,
        programs: programs.map((program) => program.programName),
        lastProgramName: last?.programName || null,
        lastProgramDate: last ? lastParticipationDate(last) : null,
        lastProgramId: last?.programId || null,
      }
    })
    .sort(
      (a, b) =>
        b.programCount - a.programCount ||
        a.familyName.localeCompare(b.familyName, undefined, { sensitivity: "base" })
    )
}

export function formatCampDate(value: string | null | undefined) {
  const iso = isoDate(value)
  if (!iso) return "—"
  const date = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}
