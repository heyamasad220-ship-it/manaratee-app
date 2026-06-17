export type ContactProfileTab =
  | "overview"
  | "participation"
  | "workforce"
  | "financial"
  | "activity"

type ContactProfileHrefOptions = {
  tab?: ContactProfileTab
  edit?: boolean
}

export function contactProfileHref(
  contactId: string,
  tabOrOptions?: ContactProfileTab | ContactProfileHrefOptions
): string {
  let tab: ContactProfileTab | undefined
  let edit = false

  if (typeof tabOrOptions === "string") {
    tab = tabOrOptions
  } else if (tabOrOptions) {
    tab = tabOrOptions.tab
    edit = tabOrOptions.edit ?? false
  }

  const params = new URLSearchParams()
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
