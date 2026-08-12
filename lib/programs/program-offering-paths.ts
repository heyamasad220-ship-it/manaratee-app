/**
 * Offering overview page — edit via dialog (`?edit=1` to auto-open).
 * Legacy `?tab=` values still resolve to this page for bookmarks.
 *
 * Department-linked years/seasons open under
 * `/workforce/departments/{deptId}/programs/{programId}/offerings/{offeringId}`
 * so the Departments sidebar stays selected.
 */

export type OfferingManageTab = "settings"

/** @deprecated Tabs removed; kept for legacy `?tab=` deep links. */
export const OFFERING_MANAGE_TABS = [
  { value: "settings", label: "Settings" },
] as const

const LEGACY_OFFERING_TAB_ALIASES = new Set([
  "overview",
  "enrollment",
  "registration",
  "fees",
  "schedule",
  "waitlist",
  "pricing",
  "staff",
  "attendance",
  "care",
  "settings",
])

export function normalizeOfferingManageTab(
  tab?: string | null
): OfferingManageTab {
  void tab
  return "settings"
}

export function isLegacyOfferingManageTab(tab?: string | null): boolean {
  if (!tab) return false
  return LEGACY_OFFERING_TAB_ALIASES.has(tab)
}

export type OfferingManageHrefOptions = {
  departmentId?: string | null
  /** @deprecated Ignored — overview is a single page; edit opens in a dialog. */
  tab?: string
  /** When true, append `?edit=1` to auto-open the edit dialog. */
  edit?: boolean
}

/**
 * Prefer department-scoped URL when `departmentId` is set so staff stay in
 * HR → Departments instead of bouncing to the Programs sidebar.
 */
export function programOfferingManageHref(
  programId: string,
  offeringId: string,
  tabOrOptions?: string | OfferingManageHrefOptions
) {
  const options: OfferingManageHrefOptions =
    typeof tabOrOptions === "string"
      ? { tab: tabOrOptions }
      : tabOrOptions || {}

  const departmentId = options.departmentId?.trim() || null
  const base = departmentId
    ? `/workforce/departments/${departmentId}/programs/${programId}/offerings/${offeringId}`
    : `/programs/${programId}/offerings/${offeringId}`

  return options.edit ? `${base}?edit=1` : base
}

export function programOfferingsIndexHref(programId: string) {
  return `/programs/${programId}/offerings`
}

/** Standalone Programs-module URL (ignores department). */
export function standaloneProgramOfferingManageHref(
  programId: string,
  offeringId: string
) {
  return `/programs/${programId}/offerings/${offeringId}`
}
