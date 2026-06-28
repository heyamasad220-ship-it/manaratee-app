import type { ContactsListSegment } from "@/lib/contacts/contact-module-label"

export type ContactProfileTab =
  | "overview"
  | "participation"
  | "workforce"
  | "financial"
  | "activity"

type ContactProfileHrefOptions = {
  tab?: ContactProfileTab
  edit?: boolean
  list?: ContactsListSegment
}

export function contactProfileHref(
  contactId: string,
  tabOrOptions?: ContactProfileTab | ContactProfileHrefOptions
): string {
  let tab: ContactProfileTab | undefined
  let edit = false
  let list: ContactsListSegment | undefined

  if (typeof tabOrOptions === "string") {
    tab = tabOrOptions
  } else if (tabOrOptions) {
    tab = tabOrOptions.tab
    edit = tabOrOptions.edit ?? false
    list = tabOrOptions.list
  }

  const params = new URLSearchParams()
  if (list) {
    params.set("list", list)
  }
  if (tab && tab !== "overview") {
    params.set("tab", tab)
  }
  if (edit) {
    params.set("edit", "1")
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
