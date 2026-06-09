/** User-facing name for the contacts module. */
export const CONTACTS_MODULE_LABEL = "Contacts"

export const CONTACTS_BASE_PATH = "/contacts"
export const CONTACTS_SETTINGS_PATH = "/contacts/settings"

export function contactsSettingsTabPath(tab: string) {
  return `${CONTACTS_SETTINGS_PATH}?tab=${tab}`
}

export const CONTACTS_DISCOUNT_TAGS_PATH = contactsSettingsTabPath("discount-tags")

/** @deprecated Use CONTACTS_DISCOUNT_TAGS_PATH */
export const CONTACTS_BENEFITS_PATH = CONTACTS_DISCOUNT_TAGS_PATH
