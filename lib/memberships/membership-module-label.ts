/** User-facing name for the membership module. */
export const MEMBERSHIP_MODULE_LABEL = "Membership"

export const MEMBERSHIP_BASE_PATH = "/membership"
export const MEMBERSHIP_MEMBERS_PATH = "/membership/members"
export const MEMBERSHIP_TEAMS_PATH = "/membership/teams"
export const MEMBERSHIP_BENEFITS_PATH = "/contacts/settings?tab=discount-tags"
export const MEMBERSHIP_SETTINGS_PATH = "/membership/settings"

export function membershipTeamDetailPath(teamId: string) {
  return `${MEMBERSHIP_TEAMS_PATH}/${teamId}`
}
