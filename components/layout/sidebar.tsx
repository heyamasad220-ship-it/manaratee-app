"use client"

import { useState, useEffect, createContext, useContext } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  Calendar,
  Building2,
  CreditCard,
  Settings,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  Store,
  Heart,
  Users,
  Home,
  GraduationCap,
  Menu,
  X,
  Ticket,
  Boxes,
  FileText,
  ClipboardList,
  Baby,
  UserCheck,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { createClient } from "@/lib/supabase/client"
import { getCurrentOrganizationContext, clearSelectedOrganizationIdCache } from "@/lib/current-organization"
import { isOrganizationSystemAdmin } from "@/lib/organizations/organization-system-admin"
import { WORKFORCE_MODULE_LABEL } from "@/lib/hr/hr-module-label"
import { isFacilitiesOnlyAccess } from "@/lib/permissions/facilities-access"
import {
  programsFinancialAssistanceNavItem,
} from "@/lib/applications/application-nav"

interface SubItem {
  label: string
  href: string
  matchPrefix: string
  alsoMatchPrefixes?: string[]
  permissionKey?: string
}

function subItemMatchesPath(child: SubItem, pathname: string) {
  if (pathname === child.href || pathname.startsWith(`${child.matchPrefix}/`)) {
    return true
  }
  return child.alsoMatchPrefixes?.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  matchPrefix: string
  children?: SubItem[]
  group?: string | null
  permissionKey?: string
  moduleSlug?: string
}

interface SidebarModuleRow {
  name: string
  slug: string
  route: string | null
  icon_name: string | null
  group_name: string | null
  sort_order: number | null
}

/** Shown when DB module rows are missing (before migrations 032/033 are applied). */
const HIDDEN_SIDEBAR_MODULE_SLUGS = new Set([
  "sign-ups",
  "child-care",
  "ticketing",
  "bazaar",
  "hr",
  "reports",
  "applications",
])

/** Ensures Event Management appears before SQL migration 038 is applied. */
const STATIC_SIDEBAR_MODULES: SidebarModuleRow[] = [
  {
    name: "Event Management",
    slug: "event-management",
    route: "/event-management/overview",
    icon_name: "LayoutGrid",
    group_name: "Operations",
    sort_order: 40,
  },
  {
    name: "Membership",
    slug: "membership",
    route: "/membership",
    icon_name: "UserCheck",
    group_name: "People",
    sort_order: 36,
  },
  {
    name: "Workforce",
    slug: "workforce",
    route: "/workforce",
    icon_name: "Users",
    group_name: "People",
    sort_order: 35,
  },
]

const moduleSortOrderOverride: Record<string, number> = {
  workforce: 35,
  "event-management": 40,
  membership: 36,
  bookings: 41,
  programs: 42,
  "vendor-hub": 43,
  spaces: 50,
}

function mergeSidebarModules(rows: SidebarModuleRow[]): SidebarModuleRow[] {
  const bySlug = new Map<string, SidebarModuleRow>()

  for (const row of rows) {
    if (HIDDEN_SIDEBAR_MODULE_SLUGS.has(row.slug)) {
      continue
    }

    const staticRow = STATIC_SIDEBAR_MODULES.find((item) => item.slug === row.slug)
    bySlug.set(row.slug, {
      ...staticRow,
      ...row,
      name: row.name || staticRow?.name || row.slug,
      route: row.route || staticRow?.route || null,
      icon_name: row.icon_name || staticRow?.icon_name || null,
      group_name: row.group_name || staticRow?.group_name || null,
      sort_order: moduleSortOrderOverride[row.slug] ?? row.sort_order ?? staticRow?.sort_order ?? null,
    })
  }

  return Array.from(bySlug.values()).sort((a, b) => {
    const aOrder = a.sort_order ?? 999
    const bOrder = b.sort_order ?? 999
    if (aOrder !== bOrder) return aOrder - bOrder
    return a.name.localeCompare(b.name)
  })
}

interface UserPermissionContext {
  isOwner: boolean
  enabledPermissions: Set<string>
}

const iconMap: Record<string, LucideIcon> = {
  Calendar,
  Building2,
  CreditCard,
  Settings,
  LayoutGrid,
  Store,
  Heart,
  Users,
  Home,
  GraduationCap,
  Ticket,
  Boxes,
  FileText,
  ClipboardList,
  Baby,
  UserCheck,
}

const modulePermissionMap: Record<string, string> = {
  programs: "programs.view",
  donations: "donations.view",
  workforce: "staff.view",
  hr: "staff.view",
  staff: "staff.view",
  applications: "applications.view",
  contacts: "contacts.view",
  membership: "membership.view",
  reports: "reports.view",
  ticketing: "ticketing.view",
  bookings: "bookings.view",
  spaces: "spaces.view",
  "vendor-hub": "vendor_hub.view",
  "event-management": "events.view",
}

/** Until roles are updated, show Event Management to users with Programs access. */
const modulePermissionFallbacks: Record<string, string[]> = {
  "event-management": ["programs.view", "ticketing.view", "ticketing.manage"],
  membership: ["contacts.view"],
}

const subItemPermissionFallbacks: Record<string, string[]> = {
  "events.view": ["programs.view"],
  "events.manage": ["programs.manage"],
  "reports.view": ["events.view", "programs.view"],
  "ticketing.view": ["events.view", "programs.view", "ticketing.manage"],
  "ticketing.manage": ["events.manage", "programs.manage"],
  "membership.view": ["contacts.view"],
  "membership.manage": ["contacts.manage"],
}

const SIDEBAR_GROUP_ORDER = [
  "People",
  "Operations",
  "Facilities",
  "Financial",
  "System",
] as const

const moduleDisplayNameMap: Record<string, string> = {
  workforce: WORKFORCE_MODULE_LABEL,
  hr: WORKFORCE_MODULE_LABEL,
  bookings: "Venue Rentals",
  spaces: "Facilities",
}

function resolveModuleNavSlug(slug: string) {
  return slug === "hr" ? "workforce" : slug
}

const moduleGroupOverride: Record<string, string> = {
  spaces: "Facilities",
  "vendor-hub": "Operations",
}

const moduleDefaultRouteOverride: Record<string, string> = {
  spaces: "/facilities/reservation-center",
  workforce: "/workforce",
  hr: "/workforce",
}

const moduleChildren: Record<string, SubItem[]> = {
  bookings: [
    { label: "Dashboard", href: "/bookings/overview", matchPrefix: "/bookings/overview", permissionKey: "bookings.view" },
    { label: "Requests", href: "/bookings/requests", matchPrefix: "/bookings/requests", permissionKey: "bookings.manage" },
    { label: "Settings", href: "/bookings/settings", matchPrefix: "/bookings/settings", permissionKey: "bookings.manage" },
  ],
  "event-management": [
    { label: "Dashboard", href: "/event-management/overview", matchPrefix: "/event-management/overview", permissionKey: "events.view" },
    { label: "Space Availability", href: "/facilities/availability", matchPrefix: "/facilities/availability", permissionKey: "events.view" },
    { label: "Events", href: "/event-management", matchPrefix: "/event-management", permissionKey: "events.view" },
    { label: "Ticketing", href: "/event-management/ticketing", matchPrefix: "/event-management/ticketing", permissionKey: "ticketing.view" },
    { label: "Reports", href: "/event-management/reports", matchPrefix: "/event-management/reports", permissionKey: "reports.view" },
    { label: "Settings", href: "/event-management/settings/event-types", matchPrefix: "/event-management/settings", permissionKey: "events.manage" },
  ],
  spaces: [
    { label: "Spaces", href: "/facilities/settings/spaces", matchPrefix: "/facilities/settings/spaces", permissionKey: "spaces.view" },
    { label: "Resources", href: "/facilities/resources", matchPrefix: "/facilities/resources", permissionKey: "spaces.view" },
    { label: "Reservation Center", href: "/facilities/reservation-center", matchPrefix: "/facilities/reservation-center", permissionKey: "spaces.view" },
    { label: "Space Availability", href: "/facilities/availability", matchPrefix: "/facilities/availability", permissionKey: "spaces.view" },
    { label: "Schedule", href: "/facilities/calendar", matchPrefix: "/facilities/calendar", permissionKey: "spaces.view" },
  ],
  programs: [
    { label: "Catalog", href: "/programs/catalog", matchPrefix: "/programs/catalog", permissionKey: "programs.view" },
    { label: "Registrations", href: "/programs/registrations", matchPrefix: "/programs/registrations", permissionKey: "programs.manage" },
    { label: "Schedule", href: "/programs/schedule", matchPrefix: "/programs/schedule", permissionKey: "programs.view" },
    { label: "Reports", href: "/programs/reports", matchPrefix: "/programs/reports", permissionKey: "reports.view" },
    programsFinancialAssistanceNavItem(),
    { label: "Settings", href: "/programs/settings", matchPrefix: "/programs/settings", permissionKey: "programs.manage" },
  ],
  "vendor-hub": [
    { label: "Dashboard", href: "/vendor-hub", matchPrefix: "/vendor-hub", permissionKey: "vendor_hub.view" },
    { label: "Vendor Network", href: "/vendor-hub/network/vendors", matchPrefix: "/vendor-hub/network", permissionKey: "vendor_hub.view" },
    { label: "Bazaar Events", href: "/vendor-hub/events", matchPrefix: "/vendor-hub/events", permissionKey: "vendor_hub.manage" },
    { label: "Community Calendar", href: "/vendor-hub/community-calendar", matchPrefix: "/vendor-hub/community-calendar", permissionKey: "vendor_hub.view" },
    { label: "Reports", href: "/vendor-hub/reports", matchPrefix: "/vendor-hub/reports", permissionKey: "reports.view" },
    { label: "Settings", href: "/vendor-hub/settings", matchPrefix: "/vendor-hub/settings", permissionKey: "vendor_hub.manage" },
  ],
  contacts: [
    { label: "All Contacts", href: "/contacts", matchPrefix: "/contacts", permissionKey: "contacts.view" },
    { label: "People", href: "/contacts/people", matchPrefix: "/contacts/people", permissionKey: "contacts.view" },
    { label: "Families", href: "/contacts/families", matchPrefix: "/contacts/families", permissionKey: "contacts.view" },
    { label: "Organizations", href: "/contacts/organizations", matchPrefix: "/contacts/organizations", permissionKey: "contacts.view" },
    { label: "Settings", href: "/contacts/settings", matchPrefix: "/contacts/settings", permissionKey: "contacts.view" },
  ],
  membership: [
    { label: "Overview", href: "/membership", matchPrefix: "/membership", permissionKey: "membership.view" },
    { label: "Members", href: "/membership/members", matchPrefix: "/membership/members", permissionKey: "membership.view" },
    { label: "Teams", href: "/membership/teams", matchPrefix: "/membership/teams", permissionKey: "membership.view" },
    { label: "Settings", href: "/membership/settings", matchPrefix: "/membership/settings", permissionKey: "membership.manage" },
  ],
  donations: [
    { label: "Overview", href: "/donations", matchPrefix: "/donations", permissionKey: "donations.view" },
    { label: "Donors", href: "/donations/donors", matchPrefix: "/donations/donors", permissionKey: "donations.view" },
    {
      label: "Records",
      href: "/donations/payments",
      matchPrefix: "/donations/payments",
      alsoMatchPrefixes: [
        "/donations/pledges",
        "/donations/recurring",
        "/donations/campaigns",
      ],
      permissionKey: "donations.view",
    },
    {
      label: "Donation Manager",
      href: "/donations/collect",
      matchPrefix: "/donations/collect",
      alsoMatchPrefixes: ["/donations/import", "/donations/reconcile"],
      permissionKey: "donations.view",
    },
    { label: "Reports", href: "/donations/reports", matchPrefix: "/donations/reports", permissionKey: "reports.view" },
    { label: "Settings", href: "/donations/settings", matchPrefix: "/donations/settings", permissionKey: "donations.manage" },
  ],
  workforce: [
    {
      label: "Employees",
      href: "/workforce/employees",
      matchPrefix: "/workforce/employees",
      permissionKey: "staff.view",
    },
    {
      label: "Volunteers",
      href: "/workforce/volunteers",
      matchPrefix: "/workforce/volunteers",
      permissionKey: "staff.view",
    },
    {
      label: "Childcare Providers",
      href: "/workforce/childcare",
      matchPrefix: "/workforce/childcare",
      permissionKey: "staff.view",
    },
    {
      label: "Childcare Registrations",
      href: "/workforce/childcare/registrations",
      matchPrefix: "/workforce/childcare/registrations",
      permissionKey: "staff.view",
    },
    {
      label: "Reports",
      href: "/workforce/reports",
      matchPrefix: "/workforce/reports",
      permissionKey: "reports.view",
    },
    {
      label: "Settings",
      href: "/workforce/settings",
      matchPrefix: "/workforce/settings",
      permissionKey: "staff.view",
    },
  ],
  hr: [
    {
      label: "Employees",
      href: "/workforce/employees",
      matchPrefix: "/workforce/employees",
      permissionKey: "staff.view",
    },
    {
      label: "Volunteers",
      href: "/workforce/volunteers",
      matchPrefix: "/workforce/volunteers",
      permissionKey: "staff.view",
    },
    {
      label: "Childcare Providers",
      href: "/workforce/childcare",
      matchPrefix: "/workforce/childcare",
      permissionKey: "staff.view",
    },
    {
      label: "Childcare Registrations",
      href: "/workforce/childcare/registrations",
      matchPrefix: "/workforce/childcare/registrations",
      permissionKey: "staff.view",
    },
    {
      label: "Reports",
      href: "/workforce/reports",
      matchPrefix: "/workforce/reports",
      permissionKey: "reports.view",
    },
    {
      label: "Settings",
      href: "/workforce/settings",
      matchPrefix: "/workforce/settings",
      permissionKey: "staff.view",
    },
  ],
}

function userCanAccess(permissionContext: UserPermissionContext, permissionKey?: string) {
  if (!permissionKey) return true
  if (permissionContext.isOwner) return true
  if (permissionContext.enabledPermissions.has(permissionKey)) return true

  const fallbacks = subItemPermissionFallbacks[permissionKey] || []
  return fallbacks.some((key) => permissionContext.enabledPermissions.has(key))
}

function userCanAccessModule(
  permissionContext: UserPermissionContext,
  permissionKey: string | undefined,
  moduleSlug: string | undefined,
) {
  if (userCanAccess(permissionContext, permissionKey)) return true
  if (!moduleSlug) return false

  const fallbacks = modulePermissionFallbacks[moduleSlug] || []
  return fallbacks.some((key) => userCanAccess(permissionContext, key))
}

function groupNavItemsForDisplay(navItems: NavItem[]) {
  const dashboardItems = navItems.filter((item) => item.label === "Dashboard")
  const otherItems = navItems.filter((item) => item.label !== "Dashboard")
  const byGroup = new Map<string | null, NavItem[]>()

  for (const item of otherItems) {
    const group = item.group ?? null
    const existing = byGroup.get(group) ?? []
    existing.push(item)
    byGroup.set(group, existing)
  }

  const grouped: { group: string | null; items: NavItem[] }[] = []

  if (dashboardItems.length > 0) {
    grouped.push({ group: null, items: dashboardItems })
  }

  for (const groupName of SIDEBAR_GROUP_ORDER) {
    const items = byGroup.get(groupName)
    if (items?.length) {
      grouped.push({ group: groupName, items })
      byGroup.delete(groupName)
    }
  }

  for (const [group, items] of byGroup) {
    if (items.length > 0) {
      grouped.push({ group, items })
    }
  }

  return grouped
}

function filterNavItemsByPermissions(items: NavItem[], permissionContext: UserPermissionContext): NavItem[] {
  const filtered = items
    .filter((item) => userCanAccessModule(permissionContext, item.permissionKey, item.moduleSlug))
    .map((item) => ({
      ...item,
      children: item.children?.filter((child) => userCanAccess(permissionContext, child.permissionKey)),
    }))
    .filter((item) => !(item.children && item.children.length === 0 && item.href === "#"))

  if (
    isFacilitiesOnlyAccess({
      isOwner: permissionContext.isOwner,
      enabledPermissions: permissionContext.enabledPermissions,
    })
  ) {
    return filtered
      .filter(
        (item) =>
          item.moduleSlug === "spaces" ||
          item.matchPrefix.startsWith("/facilities")
      )
      .map((item) => ({
        ...item,
        children: item.children?.filter(
          (child) => child.href !== "/facilities/availability"
        ),
      }))
  }

  return filtered
}

function buildNavItems(rows: SidebarModuleRow[], permissionContext: UserPermissionContext): NavItem[] {
  const dynamicItems: NavItem[] = rows
    .filter((row) => row.route && row.slug !== "applications")
    .map((row) => {
      const navSlug = resolveModuleNavSlug(row.slug)
      const href = (moduleDefaultRouteOverride[navSlug] ?? row.route) || "/dashboard"
      const iconName = row.icon_name || "Boxes"
      const Icon = iconMap[iconName] || Boxes
      return {
        label: moduleDisplayNameMap[navSlug] ?? moduleDisplayNameMap[row.slug] ?? row.name,
        href,
        icon: Icon,
        matchPrefix: href,
        group: moduleGroupOverride[navSlug] ?? row.group_name,
        permissionKey: modulePermissionMap[navSlug] ?? modulePermissionMap[row.slug],
        moduleSlug: row.slug,
        children: moduleChildren[navSlug] || moduleChildren[row.slug] || [
          { label: "Overview", href, matchPrefix: href, permissionKey: modulePermissionMap[navSlug] ?? modulePermissionMap[row.slug] },
        ],
      }
    })

  const allItems: NavItem[] = [
    { label: "Dashboard", href: "/dashboard", icon: Home, matchPrefix: "/dashboard" },
    ...dynamicItems,
    {
      label: "Settings",
      href: "/settings/users",
      icon: Settings,
      matchPrefix: "/settings",
      group: "System",
      children: [
        { label: "Users", href: "/settings/users", matchPrefix: "/settings/users", permissionKey: "settings.users.view" },
        { label: "Roles & Permissions", href: "/settings/roles-permissions", matchPrefix: "/settings/roles-permissions", permissionKey: "settings.roles.view" },
        { label: "Subscription", href: "/settings/subscription", matchPrefix: "/settings/subscription", permissionKey: "settings.users.view" },
      ],
    },
  ]

  return filterNavItemsByPermissions(allItems, permissionContext)
}

function isItemActive(item: NavItem, pathname: string, navItems: NavItem[]) {
  const matchesSelf = pathname.startsWith(item.matchPrefix)
  const matchesChild =
    item.children?.some((child) => subItemMatchesPath(child, pathname)) ?? false
  const isOverridden = navItems.some(
    (other) =>
      other.label !== item.label &&
      other.matchPrefix.startsWith(item.matchPrefix) &&
      other.matchPrefix.length > item.matchPrefix.length &&
      pathname.startsWith(other.matchPrefix),
  )
  return (matchesSelf && !isOverridden) || matchesChild
}

function findActiveModuleWithChildren(navItems: NavItem[], pathname: string): NavItem | null {
  for (const item of navItems) {
    if (item.children && item.children.length > 0 && isItemActive(item, pathname, navItems)) {
      return item
    }
  }
  return null
}

function isChildActive(child: SubItem, siblings: SubItem[], pathname: string) {
  const selfMatches = subItemMatchesPath(child, pathname)
  if (!selfMatches) return false

  const isChildOverridden = siblings.some(
    (other) =>
      other.label !== child.label &&
      subItemMatchesPath(other, pathname) &&
      (other.matchPrefix.length > child.matchPrefix.length ||
        Boolean(other.alsoMatchPrefixes?.length))
  )
  return !isChildOverridden
}

interface SidebarContextType {
  mobileOpen: boolean
  setMobileOpen: (open: boolean) => void
  navItems: NavItem[]
  loading: boolean
}

const SidebarContext = createContext<SidebarContextType | null>(null)

export function useSidebarContext() {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebarContext must be used within SidebarProvider")
  }
  return context
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [navItems, setNavItems] = useState<NavItem[]>([
    { label: "Dashboard", href: "/dashboard", icon: Home, matchPrefix: "/dashboard" },
  ])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadSidebarModules() {
      setLoading(true)
      clearSelectedOrganizationIdCache()
      const supabase = createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setNavItems([{ label: "Dashboard", href: "/dashboard", icon: Home, matchPrefix: "/dashboard" }])
        setLoading(false)
        return
      }

      const { organizationId, platformSupportMode } = await getCurrentOrganizationContext()
      if (!organizationId) {
        console.error("Error loading organization membership: no selected organization")
        setNavItems([{ label: "Dashboard", href: "/dashboard", icon: Home, matchPrefix: "/dashboard" }])
        setLoading(false)
        return
      }

      const { data: membership, error: membershipError } = await supabase
        .from("organization_members")
        .select("organization_id, role, role_id")
        .eq("user_id", user.id)
        .eq("organization_id", organizationId)
        .maybeSingle()

      if (membershipError || !membership) {
        console.error("Error loading organization membership:", membershipError)
        setNavItems([{ label: "Dashboard", href: "/dashboard", icon: Home, matchPrefix: "/dashboard" }])
        setLoading(false)
        return
      }

      let permissionContext: UserPermissionContext = {
        isOwner: platformSupportMode || isOrganizationSystemAdmin(membership.role),
        enabledPermissions: new Set<string>(),
      }

      if (membership.role_id) {
        const { data: permissionRows, error: permissionsError } = await supabase
          .from("role_permissions")
          .select("permission_key, enabled")
          .eq("organization_id", membership.organization_id)
          .eq("role_id", membership.role_id)
          .eq("enabled", true)

        if (permissionsError) {
          console.error("Error loading sidebar permissions:", permissionsError)
        } else {
          permissionContext = {
            ...permissionContext,
            enabledPermissions: new Set((permissionRows || []).map((row) => row.permission_key)),
          }
        }
      }

      const modulesResponse = await fetch("/api/organizations/sidebar-modules", {
        cache: "no-store",
      })
      const modulesPayload = modulesResponse.ok
        ? await modulesResponse.json()
        : { modules: [] as SidebarModuleRow[] }

      const moduleRows = (modulesPayload.modules || []) as SidebarModuleRow[]

      if (!modulesResponse.ok) {
        console.error("Error loading sidebar modules:", modulesPayload.error)
      }

      setNavItems(buildNavItems(mergeSidebarModules(moduleRows), permissionContext))
      setLoading(false)
    }

    loadSidebarModules()
  }, [pathname])

  return (
    <SidebarContext.Provider value={{ mobileOpen, setMobileOpen, navItems, loading }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function MobileMenuTrigger() {
  const { setMobileOpen } = useSidebarContext()
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-10 w-10 lg:hidden"
      onClick={() => setMobileOpen(true)}
      aria-label="Open menu"
    >
      <Menu className="h-5 w-5" />
    </Button>
  )
}

function PrimaryNavLink({
  item,
  isActive,
  onNavigate,
  showChevron,
}: {
  item: NavItem
  isActive: boolean
  onNavigate?: () => void
  showChevron?: boolean
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "relative flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        isActive ? "bg-amber-50 text-amber-700" : "text-zinc-700 hover:bg-amber-50 hover:text-amber-700",
      )}
    >
      {isActive && <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-amber-600" />}
      <item.icon className="h-[18px] w-[18px] shrink-0" />
      <span className="flex-1">{item.label}</span>
      {showChevron ? <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" /> : null}
    </Link>
  )
}

function SidebarPrimaryNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { navItems, loading } = useSidebarContext()

  const groupedItems = groupNavItemsForDisplay(navItems)

  if (loading) {
    return (
      <nav className="flex flex-1 flex-col gap-2 px-3 pt-3">
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="h-11 animate-pulse rounded-lg bg-amber-50" />
        ))}
      </nav>
    )
  }

  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pt-3 pb-4">
      {groupedItems.map((group, groupIndex) => (
        <div key={`${group.group ?? "main"}-${groupIndex}`} className={groupIndex > 0 ? "mt-5" : ""}>
          {group.group ? (
            <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              {group.group}
            </div>
          ) : null}

          {group.items.map((item) => (
            <PrimaryNavLink
              key={item.label}
              item={item}
              isActive={isItemActive(item, pathname, navItems)}
              onNavigate={onNavigate}
              showChevron={Boolean(item.children && item.children.length > 0)}
            />
          ))}
        </div>
      ))}
    </nav>
  )
}

function SidebarSubNavLinks({
  module,
  onNavigate,
}: {
  module: NavItem
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const children = module.children ?? []

  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pt-3 pb-4">
      {children.map((child) => {
        const active = isChildActive(child, children, pathname)
        return (
          <Link
            key={child.label}
            href={child.href}
            onClick={onNavigate}
            className={cn(
              "relative flex min-h-[40px] items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-amber-50 text-amber-700" : "text-zinc-600 hover:bg-amber-50 hover:text-amber-700",
            )}
          >
            {active ? <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-amber-600" /> : null}
            {child.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function ModuleSubNav() {
  const pathname = usePathname()
  const { navItems, loading } = useSidebarContext()
  const activeModule = findActiveModuleWithChildren(navItems, pathname)

  if (loading || !activeModule?.children?.length) {
    return null
  }

  return (
    <aside className="hidden h-screen w-[200px] shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/80 text-zinc-900 lg:flex">
      <div className="flex h-[88px] items-end border-b border-zinc-200 px-4 pb-3">
        <p className="text-sm font-semibold text-zinc-900">{activeModule.label}</p>
      </div>
      <SidebarSubNavLinks module={activeModule} />
    </aside>
  )
}

function SidebarHeader() {
  return (
    <div className="flex h-[88px] items-center justify-center overflow-hidden border-b border-zinc-200 px-2">
      <Image
        src="/logo.png"
        alt="Manaratee"
        width={240}
        height={120}
        className="h-auto w-full origin-center scale-[1.45] object-contain"
        priority
      />
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="hidden h-screen w-[220px] shrink-0 flex-col border-r border-zinc-200 bg-white text-zinc-900 lg:flex">
      <SidebarHeader />
      <SidebarPrimaryNav />
    </aside>
  )
}

export function MobileSidebar() {
  const { mobileOpen, setMobileOpen, navItems, loading } = useSidebarContext()
  const pathname = usePathname()
  const [mobileModule, setMobileModule] = useState<NavItem | null>(null)

  useEffect(() => {
    if (!mobileOpen) {
      setMobileModule(null)
    }
  }, [mobileOpen])

  useEffect(() => {
    if (mobileOpen) {
      const active = findActiveModuleWithChildren(navItems, pathname)
      setMobileModule(active)
    }
  }, [mobileOpen, navItems, pathname])

  function closeMobile() {
    setMobileOpen(false)
    setMobileModule(null)
  }

  function handlePrimaryClick(item: NavItem) {
    if (item.children && item.children.length > 0) {
      setMobileModule(item)
      return
    }
    closeMobile()
  }

  const groupedItems = groupNavItemsForDisplay(navItems)

  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent side="left" className="w-[280px] border-r border-zinc-200 bg-white p-0 text-zinc-900">
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>

        <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-3">
          <div className="flex h-[72px] min-w-0 flex-1 items-center overflow-hidden pr-2">
            {mobileModule ? (
              <button
                type="button"
                onClick={() => setMobileModule(null)}
                className="flex items-center gap-2 text-sm font-medium text-zinc-700 hover:text-amber-700"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
            ) : (
              <Image
                src="/logo.png"
                alt="Manaratee"
                width={220}
                height={100}
                className="h-auto w-full origin-center scale-[1.35] object-contain"
                priority
              />
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-700 hover:bg-amber-50 hover:text-amber-700"
            onClick={closeMobile}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <nav className="flex flex-col gap-2 px-3 pt-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-lg bg-amber-50" />
            ))}
          </nav>
        ) : mobileModule ? (
          <div className="flex h-[calc(100vh-88px)] flex-col">
            <div className="border-b border-zinc-200 px-4 py-3">
              <p className="text-sm font-semibold text-zinc-900">{mobileModule.label}</p>
            </div>
            <SidebarSubNavLinks module={mobileModule} onNavigate={closeMobile} />
          </div>
        ) : (
          <nav className="flex max-h-[calc(100vh-88px)] flex-col gap-0.5 overflow-y-auto px-3 pt-3 pb-4">
            {groupedItems.map((group, groupIndex) => (
              <div key={`${group.group ?? "main"}-${groupIndex}`} className={groupIndex > 0 ? "mt-5" : ""}>
                {group.group ? (
                  <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    {group.group}
                  </div>
                ) : null}

                {group.items.map((item) => {
                  const hasChildren = Boolean(item.children && item.children.length > 0)

                  if (hasChildren) {
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => handlePrimaryClick(item)}
                        className={cn(
                          "relative flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                          isItemActive(item, pathname, navItems)
                            ? "bg-amber-50 text-amber-700"
                            : "text-zinc-700 hover:bg-amber-50 hover:text-amber-700",
                        )}
                      >
                        {isItemActive(item, pathname, navItems) ? (
                          <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-amber-600" />
                        ) : null}
                        <item.icon className="h-[18px] w-[18px] shrink-0" />
                        <span className="flex-1 text-left">{item.label}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
                      </button>
                    )
                  }

                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={closeMobile}
                      className={cn(
                        "relative flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        isItemActive(item, pathname, navItems)
                          ? "bg-amber-50 text-amber-700"
                          : "text-zinc-700 hover:bg-amber-50 hover:text-amber-700",
                      )}
                    >
                      {isItemActive(item, pathname, navItems) ? (
                        <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-amber-600" />
                      ) : null}
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            ))}
          </nav>
        )}
      </SheetContent>
    </Sheet>
  )
}
