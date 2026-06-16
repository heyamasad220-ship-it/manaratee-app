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

  EVENTS_VIEW: "events.view",
  EVENTS_MANAGE: "events.manage",

  TICKETING_VIEW: "ticketing.view",
  TICKETING_MANAGE: "ticketing.manage",

  MEMBERSHIP_VIEW: "membership.view",
  MEMBERSHIP_MANAGE: "membership.manage",

  BOOKINGS_VIEW: "bookings.view",
  BOOKINGS_MANAGE: "bookings.manage",

  SPACES_VIEW: "spaces.view",
  SPACES_MANAGE: "spaces.manage",

  FINANCE_VIEW: "finance.view",
  FINANCE_MANAGE: "finance.manage",

  VENDOR_HUB_VIEW: "vendor_hub.view",
  VENDOR_HUB_MANAGE: "vendor_hub.manage",

  CONTACTS_VIEW: "contacts.view",
  CONTACTS_MANAGE: "contacts.manage",
} as const

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]
