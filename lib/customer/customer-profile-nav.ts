export type CustomerProfileSection =
  | "personal"
  | "family"
  | "notifications"
  | "applications"
  | "vendor"

export type CustomerProfileNavItem = {
  label: string
  href: string
  section: CustomerProfileSection
  /** When true, only show for approved org vendors. */
  requiresApprovedVendor?: boolean
}

export const CUSTOMER_PROFILE_NAV_ITEMS: CustomerProfileNavItem[] = [
  {
    label: "Family",
    href: "/customer/profile/family",
    section: "family",
  },
  {
    label: "Notification Preferences",
    href: "/customer/profile/notifications",
    section: "notifications",
  },
  {
    label: "Applications",
    href: "/customer/profile/applications",
    section: "applications",
  },
  {
    label: "Vendor profile",
    href: "/customer/profile/vendor",
    section: "vendor",
    requiresApprovedVendor: true,
  },
]

export function isCustomerProfilePath(pathname: string): boolean {
  return (
    pathname === "/customer/profile" || pathname.startsWith("/customer/profile/")
  )
}

export function resolveCustomerProfileSection(
  sectionParam?: string
): CustomerProfileSection {
  if (sectionParam === "family") return "family"
  if (sectionParam === "notifications") return "notifications"
  if (sectionParam === "applications") return "applications"
  if (sectionParam === "vendor") return "vendor"
  return "personal"
}

export function isCustomerProfileNavItemActive(
  href: string,
  pathname: string
): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function customerProfileSectionTitle(section: CustomerProfileSection): string {
  switch (section) {
    case "family":
      return "Family"
    case "notifications":
      return "Notification Preferences"
    case "applications":
      return "Applications"
    case "vendor":
      return "Vendor profile"
    default:
      return "Profile"
  }
}

export function filterCustomerProfileNavItems(
  items: CustomerProfileNavItem[],
  isApprovedVendor: boolean
) {
  return items.filter((item) => !item.requiresApprovedVendor || isApprovedVendor)
}
