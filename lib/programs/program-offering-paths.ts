/**
 * Offering manage page tabs and legacy query aliases.
 * Overview includes staff assignment. Enrollment holds registration, fees,
 * schedule, and waitlist enable/disable. Attendance / waitlist *views* live
 * under Programs → Reports.
 */

export const OFFERING_MANAGE_TABS = [
  { value: "overview", label: "Overview" },
  { value: "enrollment", label: "Enrollment" },
] as const

export type OfferingManageTab = (typeof OFFERING_MANAGE_TABS)[number]["value"]

const LEGACY_OFFERING_TAB_MAP: Record<string, OfferingManageTab> = {
  registration: "enrollment",
  fees: "enrollment",
  schedule: "enrollment",
  waitlist: "enrollment",
  pricing: "enrollment",
  /** Staff assignment moved onto Overview. */
  staff: "overview",
  /** Viewing moved to Reports; feature toggles remain on Overview. */
  attendance: "overview",
  care: "overview",
}

export function normalizeOfferingManageTab(
  tab?: string | null
): OfferingManageTab {
  if (!tab || tab === "overview") return "overview"
  const mapped = LEGACY_OFFERING_TAB_MAP[tab] ?? tab
  if (mapped === "overview" || mapped === "enrollment") {
    return mapped
  }
  return "overview"
}

export function programOfferingManageHref(
  programId: string,
  offeringId: string,
  tab?: string
) {
  const base = `/programs/${programId}/offerings/${offeringId}`
  const normalized = normalizeOfferingManageTab(tab)
  if (normalized === "overview") return base
  return `${base}?tab=${encodeURIComponent(normalized)}`
}

export function programOfferingsIndexHref(programId: string) {
  return `/programs/${programId}/offerings`
}
