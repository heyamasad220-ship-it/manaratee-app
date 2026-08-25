import { getProgramKindTagLabel, type ProgramKind } from "@/lib/programs/program-kind"
import type { OfferingDeliveryFormat } from "@/lib/programs/program-offering-attributes"
import type { OfferingRegistrationState } from "@/lib/programs/program-offering-display"
import type { ProgramOfferingStatus } from "@/lib/programs/program-offering-types"

export const OFFERINGS_MANAGEMENT_PATH = "/programs/catalog"
export const OFFERINGS_VIEW_STORAGE_KEY = "manaratee.programs.offerings.view"
/** UI-only threshold for Nearly Full. Not persisted. */
export const NEARLY_FULL_RATIO = 0.8

export type OfferingsManagementView = "table" | "grouped"

export type OfferingsManagementSortKey =
  | "offering"
  | "program"
  | "department"
  | "enrollment"
  | "status"

export type OfferingsManagementEnrollmentFilter =
  | "all"
  | "available"
  | "nearly_full"
  | "full"
  | "waitlisted"

export type OfferingsManagementFilters = {
  q: string
  department: string
  program: string
  type: string
  status: string
  instructor: string
  delivery: string
  registration: string
  enrollment: string
  date: string
}

export const DEFAULT_OFFERINGS_MANAGEMENT_FILTERS: OfferingsManagementFilters = {
  q: "",
  department: "all",
  program: "all",
  type: "all",
  status: "active",
  instructor: "all",
  delivery: "all",
  registration: "all",
  enrollment: "all",
  date: "all",
}

export type OfferingsManagementRow = {
  id: string
  name: string
  status: ProgramOfferingStatus
  programId: string
  programName: string
  programKind: ProgramKind
  departmentId: string | null
  departmentName: string | null
  primaryInstructor: string | null
  deliveryFormat: OfferingDeliveryFormat
  scheduleLabel: string | null
  feeAmount: number | null
  feeIsFree: boolean
  feeAvailable: boolean
  enrolled: number
  capacityMode: string | null
  capacity: number | null
  waitlistCount: number
  registrationState: OfferingRegistrationState
  isCurrent: boolean
  offeringHref: string
  programHref: string
  editHref: string
}

export type OfferingsManagementProgramOption = {
  id: string
  name: string
  departmentId: string | null
}

export type OfferingsManagementSummary = {
  total: number
  active: number
  registrationOpen: number
  full: number
  waitlisted: number
}

const STATUS_SORT_ORDER: Record<string, number> = {
  active: 0,
  draft: 1,
  closed: 2,
  archived: 3,
}

export function parseOfferingsManagementFilters(
  params: URLSearchParams | Record<string, string | string[] | undefined>
): OfferingsManagementFilters {
  const get = (key: string) => {
    if (params instanceof URLSearchParams) {
      return params.get(key) || ""
    }
    const value = params[key]
    return Array.isArray(value) ? value[0] || "" : value || ""
  }

  return {
    q: get("q"),
    department: get("department") || "all",
    program: get("program") || "all",
    type: get("type") || "all",
    status: get("status") || DEFAULT_OFFERINGS_MANAGEMENT_FILTERS.status,
    instructor: get("instructor") || "all",
    delivery: get("delivery") || "all",
    registration: get("registration") || "all",
    enrollment: get("enrollment") || "all",
    date: get("date") || "all",
  }
}

export function buildOfferingsManagementHref(
  filters: OfferingsManagementFilters,
  extras?: { view?: OfferingsManagementView }
) {
  const params = new URLSearchParams()
  if (filters.q.trim()) params.set("q", filters.q.trim())
  if (filters.department && filters.department !== "all") {
    params.set("department", filters.department)
  }
  if (filters.program && filters.program !== "all") {
    params.set("program", filters.program)
  }
  if (filters.type && filters.type !== "all") {
    params.set("type", filters.type)
  }
  if (filters.status && filters.status !== DEFAULT_OFFERINGS_MANAGEMENT_FILTERS.status) {
    params.set("status", filters.status)
  }
  if (filters.instructor && filters.instructor !== "all") {
    params.set("instructor", filters.instructor)
  }
  if (filters.delivery && filters.delivery !== "all") {
    params.set("delivery", filters.delivery)
  }
  if (filters.registration && filters.registration !== "all") {
    params.set("registration", filters.registration)
  }
  if (filters.enrollment && filters.enrollment !== "all") {
    params.set("enrollment", filters.enrollment)
  }
  if (filters.date && filters.date !== "all") {
    params.set("date", filters.date)
  }
  if (extras?.view && extras.view !== "table") {
    params.set("view", extras.view)
  }
  const query = params.toString()
  return query ? `${OFFERINGS_MANAGEMENT_PATH}?${query}` : OFFERINGS_MANAGEMENT_PATH
}

export function offeringsManagementFiltersAreDefault(
  filters: OfferingsManagementFilters
) {
  return (
    !filters.q.trim() &&
    filters.department === "all" &&
    filters.program === "all" &&
    filters.type === "all" &&
    filters.status === DEFAULT_OFFERINGS_MANAGEMENT_FILTERS.status &&
    filters.instructor === "all" &&
    filters.delivery === "all" &&
    filters.registration === "all" &&
    filters.enrollment === "all" &&
    filters.date === "all"
  )
}

export function countActiveMoreFilters(filters: OfferingsManagementFilters) {
  let count = 0
  if (filters.instructor !== "all") count += 1
  if (filters.delivery !== "all") count += 1
  if (filters.registration !== "all") count += 1
  if (filters.enrollment !== "all") count += 1
  if (filters.date !== "all") count += 1
  return count
}

export function formatManagementFee(row: Pick<
  OfferingsManagementRow,
  "feeAvailable" | "feeIsFree" | "feeAmount"
>) {
  if (!row.feeAvailable) return "—"
  if (row.feeIsFree) return "Free"
  if (row.feeAmount == null || !Number.isFinite(row.feeAmount)) return "—"
  return row.feeAmount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: row.feeAmount % 1 === 0 ? 0 : 2,
  })
}

export function formatManagementEnrollment(row: Pick<
  OfferingsManagementRow,
  "enrolled" | "capacityMode" | "capacity"
>) {
  if (row.capacityMode === "limited") {
    const capacity = Math.max(0, Number(row.capacity || 0))
    if (capacity > 0) return `${row.enrolled} / ${capacity}`
  }
  return String(row.enrolled)
}

export function getManagementEnrollmentPercent(row: Pick<
  OfferingsManagementRow,
  "enrolled" | "capacityMode" | "capacity"
>) {
  if (row.capacityMode !== "limited") return null
  const capacity = Math.max(0, Number(row.capacity || 0))
  if (capacity <= 0) return null
  return Math.min(Math.round((row.enrolled / capacity) * 100), 100)
}

export function isOfferingFull(row: Pick<
  OfferingsManagementRow,
  "enrolled" | "capacityMode" | "capacity"
>) {
  if (row.capacityMode !== "limited") return false
  const capacity = Math.max(0, Number(row.capacity || 0))
  if (capacity <= 0) return false
  return row.enrolled >= capacity
}

export function isOfferingNearlyFull(row: Pick<
  OfferingsManagementRow,
  "enrolled" | "capacityMode" | "capacity"
>) {
  if (isOfferingFull(row)) return false
  const percent = getManagementEnrollmentPercent(row)
  if (percent == null) return false
  return percent >= NEARLY_FULL_RATIO * 100
}

export function isOfferingWaitlisted(row: Pick<OfferingsManagementRow, "waitlistCount">) {
  return row.waitlistCount > 0
}

export function matchesEnrollmentFilter(
  row: OfferingsManagementRow,
  enrollment: string
) {
  if (!enrollment || enrollment === "all") return true
  if (enrollment === "available") {
    return !isOfferingFull(row) && !isOfferingNearlyFull(row)
  }
  if (enrollment === "nearly_full") return isOfferingNearlyFull(row)
  if (enrollment === "full") return isOfferingFull(row)
  if (enrollment === "waitlisted") return isOfferingWaitlisted(row)
  return true
}

export function matchesOfferingsManagementSearch(
  row: OfferingsManagementRow,
  query: string
) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystack = [
    row.name,
    row.programName,
    row.departmentName || "",
    row.primaryInstructor || "",
  ]
    .join(" ")
    .toLowerCase()
  return haystack.includes(q)
}

export function filterOfferingsManagementRows(
  rows: OfferingsManagementRow[],
  filters: OfferingsManagementFilters
) {
  return rows.filter((row) => {
    if (!matchesOfferingsManagementSearch(row, filters.q)) return false
    if (filters.department !== "all" && row.departmentId !== filters.department) {
      return false
    }
    if (filters.program !== "all" && row.programId !== filters.program) {
      return false
    }
    if (filters.type !== "all" && row.programKind !== filters.type) {
      return false
    }
    if (filters.status !== "all" && row.status !== filters.status) {
      return false
    }
    if (
      filters.instructor !== "all" &&
      (row.primaryInstructor || "") !== filters.instructor
    ) {
      return false
    }
    if (filters.delivery !== "all" && row.deliveryFormat !== filters.delivery) {
      return false
    }
    if (
      filters.registration !== "all" &&
      row.registrationState !== filters.registration
    ) {
      return false
    }
    if (!matchesEnrollmentFilter(row, filters.enrollment)) return false
    if (filters.date === "current" && !row.isCurrent) return false
    return true
  })
}

export function sortOfferingsManagementRows(
  rows: OfferingsManagementRow[],
  sortKey: OfferingsManagementSortKey,
  direction: "asc" | "desc"
) {
  const sign = direction === "asc" ? 1 : -1
  return [...rows].sort((left, right) => {
    let cmp = 0
    if (sortKey === "offering") {
      cmp = left.name.localeCompare(right.name)
    } else if (sortKey === "program") {
      cmp = left.programName.localeCompare(right.programName)
    } else if (sortKey === "department") {
      cmp = (left.departmentName || "").localeCompare(right.departmentName || "")
    } else if (sortKey === "enrollment") {
      cmp = left.enrolled - right.enrolled
    } else if (sortKey === "status") {
      cmp =
        (STATUS_SORT_ORDER[left.status] ?? 99) -
        (STATUS_SORT_ORDER[right.status] ?? 99)
    }
    if (cmp === 0) cmp = left.name.localeCompare(right.name)
    return cmp * sign
  })
}

export function summarizeOfferingsManagement(
  rows: OfferingsManagementRow[]
): OfferingsManagementSummary {
  return {
    total: rows.length,
    active: rows.filter((row) => row.status === "active").length,
    registrationOpen: rows.filter((row) => row.registrationState === "open").length,
    full: rows.filter((row) => isOfferingFull(row)).length,
    waitlisted: rows.filter((row) => isOfferingWaitlisted(row)).length,
  }
}

export function groupOfferingsByProgram(rows: OfferingsManagementRow[]) {
  const groups: Array<{
    programId: string
    programName: string
    programHref: string
    departmentName: string | null
    programKind: ProgramKind
    programKindLabel: string
    enrolled: number
    offerings: OfferingsManagementRow[]
  }> = []
  const indexByProgram = new Map<string, number>()

  for (const row of rows) {
    const existing = indexByProgram.get(row.programId)
    if (existing == null) {
      indexByProgram.set(row.programId, groups.length)
      groups.push({
        programId: row.programId,
        programName: row.programName,
        programHref: row.programHref,
        departmentName: row.departmentName,
        programKind: row.programKind,
        programKindLabel: getProgramKindTagLabel(row.programKind),
        enrolled: row.enrolled,
        offerings: [row],
      })
      continue
    }
    groups[existing].enrolled += row.enrolled
    groups[existing].offerings.push(row)
  }

  return groups
}

export function uniqueInstructors(rows: OfferingsManagementRow[]) {
  return [
    ...new Set(
      rows
        .map((row) => row.primaryInstructor)
        .filter((name): name is string => Boolean(name && name.trim()))
    ),
  ].sort((left, right) => left.localeCompare(right))
}

export function departmentsFromRows(rows: OfferingsManagementRow[]) {
  const byId = new Map<string, string>()
  for (const row of rows) {
    if (!row.departmentId || !row.departmentName) continue
    if (!byId.has(row.departmentId)) {
      byId.set(row.departmentId, row.departmentName)
    }
  }
  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

export function programsFromRows(
  rows: OfferingsManagementRow[],
  departmentId?: string
) {
  const byId = new Map<string, OfferingsManagementProgramOption>()
  for (const row of rows) {
    if (departmentId && departmentId !== "all" && row.departmentId !== departmentId) {
      continue
    }
    if (!byId.has(row.programId)) {
      byId.set(row.programId, {
        id: row.programId,
        name: row.programName,
        departmentId: row.departmentId,
      })
    }
  }
  return [...byId.values()].sort((left, right) => left.name.localeCompare(right.name))
}

export function parseOfferingsManagementView(
  value: string | null | undefined
): OfferingsManagementView | null {
  if (value === "table" || value === "grouped") return value
  return null
}
