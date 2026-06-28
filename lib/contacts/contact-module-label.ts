/** User-facing name for the contacts module. */
export const CONTACTS_MODULE_LABEL = "Contacts"

export const CONTACTS_BASE_PATH = "/contacts/people"
export const CONTACTS_SETTINGS_PATH = "/contacts/settings"

export type ContactsListSegment = "people" | "organizations" | "groups" | "families"

export function contactsListSegmentForRecordType(
  recordType: "individual" | "organization" | "group"
): ContactsListSegment {
  if (recordType === "organization") return "organizations"
  if (recordType === "group") return "groups"
  return "people"
}

export function getContactsListPathForSegment(segment: ContactsListSegment): string {
  return `/contacts/${segment}`
}

export function getContactsListPathForRecordType(
  recordType: "individual" | "organization" | "group"
): string {
  return getContactsListPathForSegment(contactsListSegmentForRecordType(recordType))
}

export function getContactsListLabelForSegment(segment: ContactsListSegment): string {
  if (segment === "organizations") return "Organizations"
  if (segment === "groups") return "Groups"
  if (segment === "families") return "Families"
  return "People"
}

export function getContactsListLabelForRecordType(
  recordType: "individual" | "organization" | "group"
): string {
  return getContactsListLabelForSegment(contactsListSegmentForRecordType(recordType))
}

export function isContactsListSegment(value: string | null | undefined): value is ContactsListSegment {
  return value === "people" || value === "organizations" || value === "groups" || value === "families"
}

export function contactsSettingsTabPath(tab: string) {
  return `${CONTACTS_SETTINGS_PATH}?tab=${tab}`
}

export const CONTACTS_DISCOUNT_TAGS_PATH = contactsSettingsTabPath("discount-tags")

/** @deprecated Use CONTACTS_DISCOUNT_TAGS_PATH */
export const CONTACTS_BENEFITS_PATH = CONTACTS_DISCOUNT_TAGS_PATH
