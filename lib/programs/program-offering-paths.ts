/**
 * Offering overview page — edit via dialog (`?edit=1` to auto-open).
 * Legacy `?tab=` values still resolve to this page for bookmarks.
 *
 * Offering overview lives at
 * `/programs/{programId}/offerings/{offeringId}`.
 * Department-scoped URLs redirect into the Programs module.
 */

import { programWorkspaceHref } from "@/lib/programs/program-workspace-path"

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
  /** Deep-link to a session roster on the offering overview. */
  sessionId?: string | null
}

/**
 * Offering manage lives in the Programs module. `departmentId` is ignored
 * for the path (kept on the options type for older call sites).
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

  const base = `/programs/${programId}/offerings/${offeringId}`

  const params = new URLSearchParams()
  if (options.edit) params.set("edit", "1")
  if (options.sessionId) params.set("session", options.sessionId)
  const query = params.toString()
  return query ? `${base}?${query}` : base
}

export function programOfferingsIndexHref(programId: string) {
  return programWorkspaceHref(programId, { tab: "offerings" })
}

/** Standalone Programs-module URL (ignores department). */
export function standaloneProgramOfferingManageHref(
  programId: string,
  offeringId: string
) {
  return `/programs/${programId}/offerings/${offeringId}`
}
