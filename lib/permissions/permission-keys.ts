export const PERMISSIONS = {
  SETTINGS_USERS_VIEW: "settings.users.view",
  SETTINGS_USERS_MANAGE: "settings.users.manage",
  SETTINGS_ROLES_VIEW: "settings.roles.view",
  SETTINGS_ROLES_MANAGE: "settings.roles.manage",

  APPLICATIONS_VIEW: "applications.view",
  APPLICATIONS_MANAGE: "applications.manage",

  PROGRAMS_VIEW: "programs.view",
  PROGRAMS_MANAGE: "programs.manage",

  STAFF_VIEW: "staff.view",
  STAFF_MANAGE: "staff.manage",

  DONATIONS_VIEW: "donations.view",
  DONATIONS_MANAGE: "donations.manage",

  REPORTS_VIEW: "reports.view",
} as const

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]
