export type UserPortalCapabilities = {
  hasPersonalPortal: boolean
  hasTeachingPortal: boolean
  hasStaffToolsPortal: boolean
  canManageEventRequests: boolean
  hasAdminPortal: boolean
}

export type PortalId = "member" | "staff" | "teaching" | "admin"

export type PortalOption = {
  id: PortalId
  label: string
  description: string
  href: string
}
