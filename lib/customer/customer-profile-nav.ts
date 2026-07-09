export type CustomerProfileSection =
  | "personal"
  | "family"
  | "notifications"
  | "applications"

export type CustomerProfileNavItem = {
  label: string
  href: string
  section: CustomerProfileSection
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
    default:
      return "Profile"
  }
}
