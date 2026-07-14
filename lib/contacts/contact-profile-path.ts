import type { ContactsListSegment } from "@/lib/contacts/contact-module-label"
import { isSafeReturnToPath, RETURN_TO_QUERY_PARAM } from "@/lib/navigation/return-to"

/** Top-level profile surfaces. `financial` / `overview` / `details` are legacy aliases for home. */
export type ContactProfileTab =
  | "home"
  | "details"
  | "participation"
  | "workforce"
  | "financial"
  | "overview"

export type ContactProfileOverviewSection = "general" | "family" | "activity" | "overview"

type ContactProfileHrefOptions = {
  tab?: ContactProfileTab
  section?: ContactProfileOverviewSection
  edit?: boolean
  list?: ContactsListSegment
  returnTo?: string
}

export function normalizeContactProfileTab(
  value: string | null | undefined
): "home" | "participation" | "workforce" {
  if (value === "participation") return "participation"
  if (value === "workforce") return "workforce"
  // overview / financial / details / home / activity / missing → combined summary (home)
  return "home"
}

export function contactProfileHref(
  contactId: string,
  tabOrOptions?: ContactProfileTab | ContactProfileHrefOptions
): string {
  let tab: ContactProfileTab | undefined
  let section: ContactProfileOverviewSection | undefined
  let edit = false
  let list: ContactsListSegment | undefined
  let returnTo: string | undefined

  if (typeof tabOrOptions === "string") {
    tab = tabOrOptions
  } else if (tabOrOptions) {
    tab = tabOrOptions.tab
    section = tabOrOptions.section
    edit = tabOrOptions.edit ?? false
    list = tabOrOptions.list
    returnTo = tabOrOptions.returnTo
  }

  const normalized = normalizeContactProfileTab(tab)

  const params = new URLSearchParams()
  if (list) {
    params.set("list", list)
  }
  if (normalized === "participation" || normalized === "workforce") {
    params.set("tab", normalized)
  }

  // Profile sections live on the home summary page
  if (section === "activity") {
    params.set("section", "activity")
  } else if (section === "overview" || section === "general" || section === "family") {
    // Overview is default when editing; omit unless explicitly overview deep-link needed
    if (section === "overview") {
      // no query needed for overview; edit flag alone opens it
    }
  }

  if (edit) {
    params.set("edit", "1")
  }
  if (returnTo && isSafeReturnToPath(returnTo)) {
    params.set(RETURN_TO_QUERY_PARAM, returnTo)
  }

  const query = params.toString()
  return query ? `/contacts/${contactId}?${query}` : `/contacts/${contactId}`
}

export function staffMemberProfileHref(input: {
  staffId: string
  contactId?: string | null
}): string {
  if (input.contactId) {
    return contactProfileHref(input.contactId, "workforce")
  }
  return `/workforce/employees/${input.staffId}`
}
