/** User-facing name for the membership module. */
export const MEMBERSHIP_MODULE_LABEL = "Membership"

export const MEMBERSHIP_BASE_PATH = "/membership"
export const MEMBERSHIP_MEMBERS_PATH = "/membership/members"
/** Member groups (HR teams / positions). Not CRM giving collectives. */
export const MEMBERSHIP_GROUPS_PATH = "/membership/groups"
/** @deprecated Use MEMBERSHIP_GROUPS_PATH — same route, labeled Groups in the UI. */
export const MEMBERSHIP_TEAMS_PATH = MEMBERSHIP_GROUPS_PATH
export const MEMBERSHIP_BENEFITS_PATH = "/contacts/settings?tab=discount-tags"
export const MEMBERSHIP_SETTINGS_PATH = "/membership/settings"

export function membershipTeamDetailPath(teamId: string) {
  return `${MEMBERSHIP_GROUPS_PATH}/${teamId}`
}
