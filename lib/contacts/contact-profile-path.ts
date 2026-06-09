export type ContactProfileTab =
  | "overview"
  | "participation"
  | "workforce"
  | "financial"
  | "activity"

export function contactProfileHref(
  contactId: string,
  tab?: ContactProfileTab
): string {
  if (!tab || tab === "overview") {
    return `/contacts/${contactId}`
  }
  return `/contacts/${contactId}?tab=${tab}`
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
