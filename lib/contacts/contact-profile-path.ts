import type { ContactsListSegment } from "@/lib/contacts/contact-module-label"
import {
  financialModuleSectionQueryValue,
  parseFinancialModuleSection,
  type ContactFinancialModuleSection,
} from "@/lib/contacts/contact-financial-nav"
import { isSafeReturnToPath, RETURN_TO_QUERY_PARAM } from "@/lib/navigation/return-to"

/** Top-level profile surfaces. Legacy aliases map to current tabs. */
export type ContactProfileTab =
  | "overview"
  | "financial"
  | "activity"
  | "notes"
  | "participation"
  | "workforce"
  /** @deprecated Use overview */
  | "home"
  /** @deprecated Use overview */
  | "details"

export type ContactProfileOverviewSection = "general" | "family" | "activity" | "overview"

export type NormalizedContactProfileTab = "overview" | "financial" | "activity"

type ContactProfileHrefOptions = {
  tab?: ContactProfileTab
  section?: ContactProfileOverviewSection
  /** Inner Financial module section (`?module=programs`). */
  financialModule?: ContactFinancialModuleSection | string | null
  edit?: boolean
  list?: ContactsListSegment
  returnTo?: string
}

export function normalizeContactProfileTab(
  value: string | null | undefined
): NormalizedContactProfileTab {
  if (value === "financial") return "financial"
  if (
    value === "activity" ||
    value === "participation" ||
    value === "workforce"
  ) {
    return "activity"
  }
  // notes / home / overview / details / missing → Overview
  return "overview"
}

export function contactProfileHref(
  contactId: string,
  tabOrOptions?: ContactProfileTab | ContactProfileHrefOptions
): string {
  let tab: ContactProfileTab | undefined
  let section: ContactProfileOverviewSection | undefined
  let financialModule: ContactFinancialModuleSection | string | null | undefined
  let edit = false
  let list: ContactsListSegment | undefined
  let returnTo: string | undefined

  if (typeof tabOrOptions === "string") {
    tab = tabOrOptions
  } else if (tabOrOptions) {
    tab = tabOrOptions.tab
    section = tabOrOptions.section
    financialModule = tabOrOptions.financialModule
    edit = tabOrOptions.edit ?? false
    list = tabOrOptions.list
    returnTo = tabOrOptions.returnTo
  }

  // Legacy section=activity → Activity tab
  let normalized = normalizeContactProfileTab(tab)
  if (section === "activity" && (!tab || tab === "home" || tab === "overview" || tab === "details")) {
    normalized = "activity"
  }

  const params = new URLSearchParams()
  if (list) {
    params.set("list", list)
  }
  if (normalized !== "overview") {
    params.set("tab", normalized)
  }

  if (normalized === "financial") {
    const parsedModule = parseFinancialModuleSection(
      typeof financialModule === "string" ? financialModule : financialModule ?? null
    )
    if (parsedModule) {
      params.set("module", financialModuleSectionQueryValue(parsedModule))
    }
  }

  if (edit) {
    params.set("edit", "1")
  }
  if (returnTo && isSafeReturnToPath(returnTo)) {
    params.set(RETURN_TO_QUERY_PARAM, returnTo)
  }

  const query = params.toString()
  return query ? `/directory/${contactId}?${query}` : `/directory/${contactId}`
}

export function staffMemberProfileHref(input: {
  staffId: string
  contactId?: string | null
}): string {
  if (input.contactId) {
    return contactProfileHref(input.contactId, "activity")
  }
  return `/workforce/employees/${input.staffId}`
}
