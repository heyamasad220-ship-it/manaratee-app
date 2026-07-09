"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  Briefcase,
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  Gift,
  GraduationCap,
  HeartHandshake,
  Home,
  LogOut,
  Store,
  User,
} from "lucide-react"

import { OrganizationSwitcher } from "@/components/organization-switcher"
import { PortalSwitcher } from "@/components/portal/portal-switcher"
import type { UserPortalCapabilities } from "@/lib/auth/portal-capabilities-types"
import type { CustomerOrganization } from "@/lib/customer/customer-organization-types"
import {
  CUSTOMER_PORTAL_NAV_ITEMS,
  filterCustomerPortalNavItems,
} from "@/lib/customer/customer-portal-modules"
import {
  CUSTOMER_PROFILE_NAV_ITEMS,
  isCustomerProfileNavItemActive,
  isCustomerProfilePath,
} from "@/lib/customer/customer-profile-nav"
import { cn } from "@/lib/utils"

type CustomerNavProps = {
  activeOrganization: CustomerOrganization | null
  organizations: CustomerOrganization[]
  portalCapabilities?: UserPortalCapabilities
  enabledModuleSlugs?: string[]
  customerName?: string
}

const memberNavIcons = {
  "/customer/dashboard": Home,
  "/customer/rentals": CalendarDays,
  "/customer/rentals/new": CalendarPlus,
  "/customer/donation": Gift,
  "/customer/programs": HeartHandshake,
  "/customer/bazaars": Store,
  "/customer/opportunities": ClipboardList,
  "/customer/profile": User,
} as const

const teachingNavLinks = [
  { label: "My Classes", href: "/my-classes", icon: GraduationCap },
]

const staffNavLinks = [
  { label: "Staff Tools", href: "/customer/staff", icon: Briefcase },
  { label: "My event requests", href: "/customer/staff/events", icon: ClipboardList },
  {
    label: "Request event",
    href: "/customer/staff/events/request",
    icon: CalendarPlus,
  },
]

export function CustomerNav({
  activeOrganization,
  organizations,
  portalCapabilities,
  enabledModuleSlugs = [],
  customerName = "Customer",
}: CustomerNavProps) {
  const pathname = usePathname()

  const enabledSlugSet = new Set(enabledModuleSlugs)
  const filteredMemberNav = filterCustomerPortalNavItems(
    CUSTOMER_PORTAL_NAV_ITEMS,
    enabledSlugSet
  )
    .filter((item) => item.href !== "/customer/profile")
    .map((item) => ({
      ...item,
      icon:
        memberNavIcons[item.href as keyof typeof memberNavIcons] ?? Home,
    }))

  const isProfileSection = isCustomerProfilePath(pathname)

  const isTeachingPortal = pathname.startsWith("/my-classes")
  const isStaffPortal = pathname.startsWith("/customer/staff")

  const navLinks = isTeachingPortal
    ? teachingNavLinks
    : isStaffPortal
      ? staffNavLinks
      : [
          ...filteredMemberNav,
          ...(portalCapabilities?.hasStaffToolsPortal
            ? [{ label: "Staff Tools", href: "/customer/staff", icon: Briefcase }]
            : []),
          ...(portalCapabilities?.hasTeachingPortal
            ? [{ label: "My Classes", href: "/my-classes", icon: GraduationCap }]
            : []),
        ]

  const logoUrl = activeOrganization?.logo_url
  const organizationName = activeOrganization?.organization_name

  return (
    <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 border-r border-border bg-card lg:flex lg:flex-col">
      <div className="shrink-0 border-b border-border px-6 pb-5 pt-5">
        <Link
          href={isStaffPortal ? "/customer/staff" : "/customer/dashboard"}
          className="flex flex-col items-center gap-3 text-center"
        >
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={organizationName || "Organization"}
              width={220}
              height={80}
              className="h-auto max-h-20 w-full object-contain"
              priority
            />
          ) : !organizationName ? (
            <Image
              src="/logo.png"
              alt="Manaratee"
              width={220}
              height={80}
              className="h-auto w-full object-contain"
              priority
            />
          ) : null}

          {organizationName ? (
            <p className="w-full text-xl font-bold leading-tight tracking-tight text-foreground">
              {organizationName}
            </p>
          ) : null}
        </Link>
      </div>

      {activeOrganization && organizations.length > 1 && (
        <div className="border-b border-border px-6 py-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Organization
          </p>

          <OrganizationSwitcher
            organizations={organizations}
            activeOrganizationId={activeOrganization.organization_id}
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <nav className="flex flex-col gap-1">
          {navLinks.map((link) => {
            const isActive =
              pathname === link.href || pathname.startsWith(`${link.href}/`)
            const Icon = link.icon

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{link.label}</span>
              </Link>
            )
          })}

          {!isTeachingPortal && !isStaffPortal ? (
            <div className="mt-1 flex flex-col gap-1">
              <Link
                href="/customer/profile"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                  pathname === "/customer/profile"
                    ? "bg-primary/10 text-primary"
                    : isProfileSection
                      ? "text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <User className="h-4 w-4" />
                <span>Profile</span>
              </Link>

              {isProfileSection ? (
                <div className="ml-4 flex flex-col gap-0.5 border-l border-border pl-3">
                  {CUSTOMER_PROFILE_NAV_ITEMS.map((item) => {
                    const isActive = isCustomerProfileNavItemActive(item.href, pathname)

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "rounded-md px-3 py-2 text-sm transition-colors",
                          isActive
                            ? "bg-primary/10 font-medium text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
        </nav>
      </div>

      <div className="border-t border-border p-4">
        {portalCapabilities ? (
          <div className="mb-4">
            <PortalSwitcher
              capabilities={portalCapabilities}
              pathname={pathname}
            />
          </div>
        ) : null}

        <div className="mb-4 flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{customerName}</p>
          </div>
        </div>

        <Link
          href="/login"
          className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/10"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Link>
      </div>
    </aside>
  )
}