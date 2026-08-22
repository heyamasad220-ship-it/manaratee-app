import type { ContactsListSegment } from "@/lib/contacts/contact-module-label"
import {
  directoryRolePath,
  isDirectoryDynamicRoleKey,
  type DirectoryDynamicRoleKey,
} from "@/lib/directory/directory-roles"
import { donationGroupHref } from "@/lib/donations/donation-group-path"
import { DONATIONS_GROUP_GIVING_REPORT_PATH } from "@/lib/donations/donor-giving-report"

export const DIRECTORY_MODULE_LABEL = "Directory"
export const DIRECTORY_BASE_PATH = "/directory"
export const DIRECTORY_PEOPLE_PATH = "/directory/people"
export const DIRECTORY_FAMILIES_PATH = "/directory/families"
export const DIRECTORY_ORGANIZATIONS_PATH = "/directory/organizations"
/** Legacy Directory Groups URL — redirects to Fund Development Group Giving. */
export const DIRECTORY_GROUPS_PATH = "/directory/groups"
export const DIRECTORY_REPORTS_PATH = "/directory/reports"
export const DIRECTORY_SETTINGS_PATH = "/directory/settings"

export const DIRECTORY_RESERVED_SEGMENTS = new Set([
  "people",
  "families",
  "organizations",
  "groups",
  "reports",
  "settings",
  "role",
  "members",
])

export function directoryFamilyPath(familyId: string) {
  return `${DIRECTORY_FAMILIES_PATH}/${familyId}`
}

/** Giving groups open in Fund Development, not Directory. */
export function directoryGroupPath(groupContactId: string) {
  return donationGroupHref(groupContactId)
}

export function directoryListPathForSegment(segment: ContactsListSegment): string {
  if (segment === "organizations") return DIRECTORY_ORGANIZATIONS_PATH
  if (segment === "groups") return DONATIONS_GROUP_GIVING_REPORT_PATH
  if (segment === "families") return DIRECTORY_FAMILIES_PATH
  return DIRECTORY_PEOPLE_PATH
}

export function parseDirectoryRoleKey(
  value: string | null | undefined
): DirectoryDynamicRoleKey | null {
  if (!isDirectoryDynamicRoleKey(value)) return null
  return value
}

export { directoryRolePath }
