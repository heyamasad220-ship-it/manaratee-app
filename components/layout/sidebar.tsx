"use client"

import { useState, useEffect, useCallback, createContext, useContext, Suspense } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useSearchParams } from "next/navigation"
import {
  Calendar,
  Building2,
  CreditCard,
  Settings,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
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
import { isContactsListSegment, type ContactsListSegment } from "@/lib/contacts/contact-module-label"
import { DONATIONS_SIDEBAR_CHILDREN } from "@/lib/navigation/donations-sidebar-children"
import { normalizeModuleSlug } from "@/lib/modules/module-catalog"
import {
  buildSubExpandKey,
  filterSubItemsByPermission,
  findActiveModuleWithChildren,
  isChildActive,
  isContactProfilePath,
  isItemActive,
  resolveContactProfileListSegment,
  subItemHasActiveDescendant,
  subItemMatchesPath,
  type NavItem,
  type SubItem,
} from "@/lib/navigation/sidebar-nav"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { WORKFORCE_MODULE_LABEL } from "@/lib/hr/hr-module-label"
import { isFacilitiesOnlyAccess } from "@/lib/permissions/facilities-access"
import {
  STAFF_BREADCRUMB_ROW_HEIGHT_CLASS,
  STAFF_HEADER_HEIGHT_CLASS,
  STAFF_SIDEBAR_NAV_HEIGHT_CLASS,
  STAFF_SIDEBAR_NAV_TOP_CLASS,
} from "@/lib/layout/staff-dashboard-chrome"
import {
  programsFinancialAssistanceNavItem,
} from "@/lib/applications/application-nav"

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
    sort_order: 50,
  },
  {
    name: "Membership",
    slug: "membership",
    route: "/membership",
    icon_name: "UserCheck",
    group_name: "People",
    sort_order: 25,
  },
  {
    name: "HR",
    slug: "workforce",
    route: "/workforce",
    icon_name: "Users",
    group_name: "People",
    sort_order: 20,
  },
]

/** Staff sidebar module order (Dashboard is always first; Billing/Settings are pinned last). */
const moduleSortOrderOverride: Record<string, number> = {
  contacts: 10,
  workforce: 20,
  membership: 25,
  donations: 30,
  programs: 40,
  "event-management": 50,
  bookings: 60,
  "vendor-hub": 70,
  spaces: 80,
}

function mergeSidebarModules(rows: SidebarModuleRow[]): SidebarModuleRow[] {
  const bySlug = new Map<string, SidebarModuleRow>()

  for (const row of rows) {
    const slug = normalizeModuleSlug(row.slug)
    if (HIDDEN_SIDEBAR_MODULE_SLUGS.has(slug)) {
      continue
    }

    const staticRow = STATIC_SIDEBAR_MODULES.find((item) => item.slug === slug)
    bySlug.set(slug, {
      ...staticRow,
      ...row,
      slug,
      name: row.name || staticRow?.name || slug,
      route: row.route || staticRow?.route || null,
      icon_name: row.icon_name || staticRow?.icon_name || null,
      group_name: row.group_name || staticRow?.group_name || null,
      sort_order: moduleSortOrderOverride[slug] ?? row.sort_order ?? staticRow?.sort_order ?? null,
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
  isSuperAdmin: boolean
  enabledPermissions: Set<string>
}

const SIDEBAR_WIDTH_PX = 180

const SIDEBAR_WIDTH_CLASS = "w-[180px]"

const MODULE_DRAWER_WIDTH_CLASS = "w-[260px]"

const DEFAULT_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: Home, matchPrefix: "/dashboard" },
]

function parseSidebarPermissionContext(payload: {
  isOwner?: boolean
  isSuperAdmin?: boolean
  enabledPermissions?: string[]
}): UserPermissionContext {
  return {
    isOwner: payload.isOwner === true,
    isSuperAdmin: payload.isSuperAdmin === true,
    enabledPermissions: new Set(payload.enabledPermissions || []),
  }
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

const moduleDisplayNameMap: Record<string, string> = {
  workforce: WORKFORCE_MODULE_LABEL,
  hr: WORKFORCE_MODULE_LABEL,
  bookings: "Venue Rentals",
  spaces: "Facility Manager",
}

function resolveModuleNavSlug(slug: string) {
  return slug === "hr" ? "workforce" : slug
}

const moduleGroupOverride: Record<string, string> = {
  spaces: "Facilities",
  "vendor-hub": "Operations",
}

const moduleDefaultRouteOverride: Record<string, string> = {
  contacts: "/contacts/people",
  spaces: "/facilities/reservation-center",
  programs: "/workforce/departments",
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
    { label: "Events", href: "/event-management", matchPrefix: "/event-management", exact: true, permissionKey: "events.view" },
    { label: "Ticketing", href: "/event-management/ticketing", matchPrefix: "/event-management/ticketing", permissionKey: "ticketing.view" },
    {
      label: "Reports",
      href: "/event-management/reports",
      matchPrefix: "/event-management/reports",
      permissionKey: "reports.view",
      children: [
        {
          label: "Overview",
          href: "/event-management/reports",
          matchPrefix: "/event-management/reports",
          exact: true,
          permissionKey: "reports.view",
        },
        {
          label: "Childcare Registrations",
          href: "/event-management/reports/childcare",
          matchPrefix: "/event-management/reports/childcare",
          permissionKey: "events.view",
        },
      ],
    },
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
    {
      label: "Departments",
      href: "/workforce/departments",
      matchPrefix: "/workforce/departments",
      permissionKey: "staff.view",
    },
    {
      label: "Catalog",
      href: "/programs/catalog",
      matchPrefix: "/programs/catalog",
      permissionKey: "programs.view",
    },
    {
      label: "Schedule",
      href: "/programs/schedule",
      matchPrefix: "/programs/schedule",
      permissionKey: "programs.view",
    },
    programsFinancialAssistanceNavItem(),
    {
      label: "Reports",
      href: "/programs/reports",
      matchPrefix: "/programs/reports",
      alsoMatchPrefixes: ["/programs/registrations"],
      permissionKey: "reports.view",
    },
    {
      label: "Settings",
      href: "/programs/settings",
      matchPrefix: "/programs/settings",
      permissionKey: "programs.manage",
    },
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
    { label: "People", href: "/contacts/people", matchPrefix: "/contacts/people", contactListSegment: "people", permissionKey: "contacts.view" },
    { label: "Families", href: "/contacts/families", matchPrefix: "/contacts/families", contactListSegment: "families", permissionKey: "contacts.view" },
    { label: "Organizations", href: "/contacts/organizations", matchPrefix: "/contacts/organizations", contactListSegment: "organizations", permissionKey: "contacts.view" },
    { label: "Reports", href: "/contacts/reports/directory", matchPrefix: "/contacts/reports", permissionKey: "contacts.view" },
    { label: "Settings", href: "/contacts/settings", matchPrefix: "/contacts/settings", permissionKey: "contacts.view" },
  ],
  membership: [
    { label: "Overview", href: "/membership", matchPrefix: "/membership", exact: true, permissionKey: "membership.view" },
    { label: "Members", href: "/membership/members", matchPrefix: "/membership/members", permissionKey: "membership.view" },
    { label: "Applications", href: "/membership/applications", matchPrefix: "/membership/applications", permissionKey: "applications.view" },
    { label: "Groups", href: "/membership/groups", matchPrefix: "/membership/groups", permissionKey: "membership.view" },
    { label: "Settings", href: "/membership/settings", matchPrefix: "/membership/settings", permissionKey: "membership.manage" },
  ],
  donations: DONATIONS_SIDEBAR_CHILDREN,
  workforce: [
    {
      label: "Overview",
      href: "/workforce",
      matchPrefix: "/workforce",
      exact: true,
      permissionKey: "staff.view",
    },
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
      exact: true,
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
      href: "/workforce/settings/positions",
      matchPrefix: "/workforce/settings",
      permissionKey: "staff.view",
      children: [
        {
          label: "Positions",
          href: "/workforce/settings/positions",
          matchPrefix: "/workforce/settings/positions",
          permissionKey: "staff.view",
        },
        {
          label: "Application Templates",
          href: "/workforce/settings/application-templates",
          matchPrefix: "/workforce/settings/application-templates",
          permissionKey: "applications.view",
        },
      ],
    },
  ],
  hr: [
    {
      label: "Overview",
      href: "/workforce",
      matchPrefix: "/workforce",
      exact: true,
      permissionKey: "staff.view",
    },
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
      exact: true,
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
      href: "/workforce/settings/positions",
      matchPrefix: "/workforce/settings",
      permissionKey: "staff.view",
      children: [
        {
          label: "Positions",
          href: "/workforce/settings/positions",
          matchPrefix: "/workforce/settings/positions",
          permissionKey: "staff.view",
        },
        {
          label: "Application Templates",
          href: "/workforce/settings/application-templates",
          matchPrefix: "/workforce/settings/application-templates",
          permissionKey: "applications.view",
        },
      ],
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
  const footerItems = navItems.filter((item) => item.pinToBottom)
  // Keep mergeSidebarModules / moduleSortOrderOverride order — do not regroup by People/Operations.
  const otherItems = navItems.filter((item) => item.label !== "Dashboard" && !item.pinToBottom)

  const grouped: { group: string | null; items: NavItem[] }[] = []

  if (dashboardItems.length > 0) {
    grouped.push({ group: null, items: dashboardItems })
  }
  if (otherItems.length > 0) {
    grouped.push({ group: null, items: otherItems })
  }

  return { grouped, footerItems }
}

function filterNavItemsByPermissions(items: NavItem[], permissionContext: UserPermissionContext): NavItem[] {
  const canAccess = (permissionKey?: string, permissionKeys?: string[]) => {
    if (permissionKeys?.length) {
      return permissionKeys.some((key) => userCanAccess(permissionContext, key))
    }
    return userCanAccess(permissionContext, permissionKey)
  }

  const filtered = items
    .filter((item) => {
      if (item.requiresSuperAdmin && !permissionContext.isSuperAdmin) {
        return false
      }
      // Org-enabled modules are already filtered by /api/organizations/sidebar-modules.
      // Always show them in the rail; sub-nav items remain permission-gated.
      if (item.moduleSlug) {
        return true
      }
      return userCanAccessModule(permissionContext, item.permissionKey, item.moduleSlug)
    })
    .map((item) => ({
      ...item,
      children: item.children ? filterSubItemsByPermission(item.children, canAccess) : undefined,
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
      const slug = normalizeModuleSlug(row.slug)
      const navSlug = resolveModuleNavSlug(slug)
      const href = (moduleDefaultRouteOverride[navSlug] ?? row.route) || "/dashboard"
      const iconName = row.icon_name || "Boxes"
      const Icon = iconMap[iconName] || Boxes
      return {
        label: moduleDisplayNameMap[navSlug] ?? moduleDisplayNameMap[slug] ?? row.name,
        href,
        icon: Icon,
        matchPrefix: href,
        group: moduleGroupOverride[navSlug] ?? row.group_name,
        permissionKey: modulePermissionMap[navSlug] ?? modulePermissionMap[slug],
        moduleSlug: slug,
        children: moduleChildren[navSlug] || moduleChildren[slug] || [
          { label: "Overview", href, matchPrefix: href, permissionKey: modulePermissionMap[navSlug] ?? modulePermissionMap[slug] },
        ],
      }
    })

  const allItems: NavItem[] = [
    { label: "Dashboard", href: "/dashboard", icon: Home, matchPrefix: "/dashboard" },
    ...dynamicItems,
    {
      label: "Billing",
      href: "/billing",
      icon: CreditCard,
      matchPrefix: "/billing",
      requiresSuperAdmin: true,
      pinToBottom: true,
    },
    {
      label: "Settings",
      href: "/settings/users",
      icon: Settings,
      matchPrefix: "/settings",
      pinToBottom: true,
      children: [
        { label: "Users", href: "/settings/users", matchPrefix: "/settings/users", permissionKey: "settings.users.view" },
        { label: "Roles & Permissions", href: "/settings/roles-permissions", matchPrefix: "/settings/roles-permissions", permissionKey: "settings.roles.view" },
        {
          label: "Audit Log",
          href: "/settings/audit-log",
          matchPrefix: "/settings/audit-log",
          permissionKeys: [
            "settings.users.view",
            "settings.roles.view",
            "donations.view",
            "donations.manage",
          ],
        },
        {
          label: "General",
          href: "/settings/general",
          matchPrefix: "/settings/general",
          permissionKeys: ["settings.users.view", "donations.manage"],
        },
      ],
    },
  ]

  return filterNavItemsByPermissions(allItems, permissionContext)
}

interface SidebarContextType {
  mobileOpen: boolean
  setMobileOpen: (open: boolean) => void
  navItems: NavItem[]
  loading: boolean
  /** Module whose navigation drawer is open (desktop). */
  moduleDrawerModule: NavItem | null
  openModuleDrawer: (module: NavItem | null) => void
  closeModuleDrawer: () => void
  toggleModuleDrawer: (module: NavItem) => void
  /** @deprecated Use moduleDrawerModule — kept for breadcrumb handlers. */
  selectedModule: NavItem | null
  /** @deprecated Use openModuleDrawer — kept for breadcrumb handlers. */
  setSelectedModule: (module: NavItem | null) => void
  expandedSubKeys: Set<string>
  ensureSubExpanded: (keys: string[]) => void
  toggleSubExpanded: (key: string) => void
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
  const [mobileOpen, setMobileOpen] = useState(false)
  const [navItems, setNavItems] = useState<NavItem[]>(DEFAULT_NAV_ITEMS)
  const [loading, setLoading] = useState(true)
  const [moduleDrawerModule, setModuleDrawerModule] = useState<NavItem | null>(null)
  const [expandedSubKeys, setExpandedSubKeys] = useState<Set<string>>(new Set())

  const closeModuleDrawer = useCallback(() => {
    setModuleDrawerModule(null)
  }, [])

  const openModuleDrawer = useCallback((module: NavItem | null) => {
    setModuleDrawerModule(module)
  }, [])

  const toggleModuleDrawer = useCallback((module: NavItem) => {
    setModuleDrawerModule((current) => (current?.label === module.label ? null : module))
  }, [])

  const ensureSubExpanded = useCallback((keys: string[]) => {
    setExpandedSubKeys((current) => {
      let changed = false
      const next = new Set(current)
      for (const key of keys) {
        if (!next.has(key)) {
          next.add(key)
          changed = true
        }
      }
      return changed ? next : current
    })
  }, [])

  const toggleSubExpanded = useCallback((key: string) => {
    setExpandedSubKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadSidebarModules() {
      setLoading(true)

      try {
        const modulesResponse = await fetch("/api/organizations/sidebar-modules", {
          cache: "no-store",
        })

        if (cancelled) return

        if (modulesResponse.status === 401) {
          setNavItems(DEFAULT_NAV_ITEMS)
          setLoading(false)
          return
        }

        const modulesPayload = modulesResponse.ok
          ? await modulesResponse.json()
          : { modules: [] as SidebarModuleRow[], permissionContext: {} }

        if (!modulesResponse.ok) {
          console.error("Error loading sidebar modules:", modulesPayload.error)
          setNavItems(DEFAULT_NAV_ITEMS)
          setLoading(false)
          return
        }

        const moduleRows = (modulesPayload.modules || []) as SidebarModuleRow[]
        const permissionContext = parseSidebarPermissionContext(
          modulesPayload.permissionContext || {}
        )

        setNavItems(buildNavItems(mergeSidebarModules(moduleRows), permissionContext))
      } catch (error) {
        if (!cancelled) {
          console.error("Error loading sidebar modules:", error)
          setNavItems(DEFAULT_NAV_ITEMS)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadSidebarModules()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <SidebarContext.Provider
      value={{
        mobileOpen,
        setMobileOpen,
        navItems,
        loading,
        moduleDrawerModule,
        openModuleDrawer,
        closeModuleDrawer,
        toggleModuleDrawer,
        selectedModule: moduleDrawerModule,
        setSelectedModule: openModuleDrawer,
        expandedSubKeys,
        ensureSubExpanded,
        toggleSubExpanded,
      }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

function SidebarSelectionSync() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams.toString()
  const { navItems, closeModuleDrawer, ensureSubExpanded } = useSidebarContext()

  useEffect(() => {
    closeModuleDrawer()

    if (pathname === "/dashboard") {
      return
    }

    const profileListSegment = resolveContactProfileListSegment(
      pathname,
      new URLSearchParams(search)
    )
    const activeModule = findActiveModuleWithChildren(navItems, pathname, profileListSegment)

    if (!activeModule?.children?.length) {
      return
    }

    const keysToExpand: string[] = []
    for (const child of activeModule.children) {
      const expandKey = buildSubExpandKey(activeModule.label, [], child.label)
      if (subItemHasActiveDescendant(child, pathname, profileListSegment) && child.children?.length) {
        keysToExpand.push(expandKey)
      }
    }
    if (keysToExpand.length > 0) {
      ensureSubExpanded(keysToExpand)
    }
  }, [pathname, search, navItems, closeModuleDrawer, ensureSubExpanded])

  return null
}

export function SidebarNavigationSync() {
  return (
    <Suspense fallback={null}>
      <SidebarSelectionSync />
    </Suspense>
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
  isSelected,
  onNavigate,
  onSelectModule,
}: {
  item: NavItem
  isActive: boolean
  isSelected: boolean
  onNavigate?: () => void
  onSelectModule?: (item: NavItem) => void
}) {
  const highlighted = isActive || isSelected
  const hasChildren = Boolean(item.children && item.children.length > 0)
  const className = cn(
    "relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
    highlighted ? "bg-amber-50 text-amber-700" : "text-zinc-700 hover:bg-amber-50 hover:text-amber-700",
  )

  if (hasChildren) {
    return (
      <button
        type="button"
        onClick={() => {
          onSelectModule?.(item)
        }}
        className={className}
      >
        {highlighted ? (
          <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-amber-600" />
        ) : null}
        <item.icon className="h-5 w-5 shrink-0" />
        <span className="flex-1 text-left leading-tight">{item.label}</span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
      </button>
    )
  }

  return (
    <Link href={item.href} onClick={onNavigate} className={className}>
      {highlighted ? (
        <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-amber-600" />
      ) : null}
      <item.icon className="h-5 w-5 shrink-0" />
      <span className="flex-1 text-left leading-tight">{item.label}</span>
    </Link>
  )
}

function SidebarPrimaryNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const profileListSegment = resolveContactProfileListSegment(pathname, searchParams)
  const { navItems, loading, moduleDrawerModule, toggleModuleDrawer, closeModuleDrawer } = useSidebarContext()

  const { grouped, footerItems } = groupNavItemsForDisplay(navItems)

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
    <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2.5 pt-1 pb-4">
      {grouped.map((group, groupIndex) => (
        <div
          key={`${group.group ?? "main"}-${groupIndex}`}
          className={groupIndex > 0 ? "mt-3 border-t border-zinc-200 pt-3" : ""}
        >
          {group.items.map((item) => (
            <PrimaryNavLink
              key={item.label}
              item={item}
              isActive={isItemActive(item, pathname, navItems, profileListSegment)}
              isSelected={moduleDrawerModule?.label === item.label}
              onNavigate={() => {
                closeModuleDrawer()
                onNavigate?.()
              }}
              onSelectModule={toggleModuleDrawer}
            />
          ))}
        </div>
      ))}

      {footerItems.length > 0 ? (
        <div className="mt-4 border-t border-zinc-200 pt-3">
          {footerItems.map((item) => (
            <PrimaryNavLink
              key={item.label}
              item={item}
              isActive={isItemActive(item, pathname, navItems, profileListSegment)}
              isSelected={moduleDrawerModule?.label === item.label}
              onNavigate={() => {
                closeModuleDrawer()
                onNavigate?.()
              }}
              onSelectModule={toggleModuleDrawer}
            />
          ))}
        </div>
      ) : null}
    </nav>
  )
}

function SidebarSubNavItem({
  item,
  siblings,
  moduleLabel,
  ancestorLabels,
  depth,
  onNavigate,
}: {
  item: SubItem
  siblings: SubItem[]
  moduleLabel: string
  ancestorLabels: string[]
  depth: number
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const profileListSegment = resolveContactProfileListSegment(pathname, searchParams)
  const { expandedSubKeys, toggleSubExpanded } = useSidebarContext()
  const hasChildren = Boolean(item.children && item.children.length > 0)
  const expandKey = buildSubExpandKey(moduleLabel, ancestorLabels, item.label)
  const isExpanded = expandedSubKeys.has(expandKey) || subItemHasActiveDescendant(item, pathname, profileListSegment)
  const active = isChildActive(item, siblings, pathname, profileListSegment)

  if (hasChildren) {
    return (
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => toggleSubExpanded(expandKey)}
          className={cn(
            "relative flex min-h-[40px] items-center rounded-md px-3 py-2 text-left text-sm font-medium transition-colors",
            active ? "bg-amber-50 text-amber-700" : "text-zinc-600 hover:bg-amber-50 hover:text-amber-700",
          )}
          style={{ paddingLeft: `${12 + depth * 12}px` }}
        >
          {active ? (
            <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-amber-600" />
          ) : null}
          <span className="flex-1">{item.label}</span>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
          )}
        </button>
        {isExpanded
          ? item.children?.map((child) => (
              <SidebarSubNavItem
                key={`${item.label}-${child.label}`}
                item={child}
                siblings={item.children ?? []}
                moduleLabel={moduleLabel}
                ancestorLabels={[...ancestorLabels, item.label]}
                depth={depth + 1}
                onNavigate={onNavigate}
              />
            ))
          : null}
      </div>
    )
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "relative flex min-h-[40px] items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-amber-50 text-amber-700" : "text-zinc-600 hover:bg-amber-50 hover:text-amber-700",
      )}
      style={{ paddingLeft: `${12 + depth * 12}px` }}
    >
      {active ? <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-amber-600" /> : null}
      {item.label}
    </Link>
  )
}

function SidebarSubNavLinks({
  module,
  onNavigate,
}: {
  module: NavItem
  onNavigate?: () => void
}) {
  const children = module.children ?? []

  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pt-3 pb-4">
      {children.map((child) => (
        <SidebarSubNavItem
          key={child.label}
          item={child}
          siblings={children}
          moduleLabel={module.label}
          ancestorLabels={[]}
          depth={0}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  )
}

function ModuleNavDrawerContent() {
  const { moduleDrawerModule, closeModuleDrawer } = useSidebarContext()
  const open = Boolean(moduleDrawerModule?.children?.length)

  if (!open || !moduleDrawerModule) {
    return null
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[55] hidden bg-black/20 lg:block"
        style={{ left: SIDEBAR_WIDTH_PX }}
        onClick={closeModuleDrawer}
        aria-label="Close navigation menu"
      />
      <aside
        className={cn(
          "fixed z-[60] hidden flex-col border-r border-zinc-200 bg-white text-zinc-900 shadow-xl lg:flex",
          STAFF_SIDEBAR_NAV_TOP_CLASS,
          STAFF_SIDEBAR_NAV_HEIGHT_CLASS,
          MODULE_DRAWER_WIDTH_CLASS,
        )}
        style={{ left: SIDEBAR_WIDTH_PX }}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 px-4">
          <p className="text-sm font-semibold text-zinc-800">{moduleDrawerModule.label}</p>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-600 hover:bg-amber-50 hover:text-amber-700"
            onClick={closeModuleDrawer}
            aria-label="Close module menu"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <SidebarSubNavLinks module={moduleDrawerModule} onNavigate={closeModuleDrawer} />
      </aside>
    </>
  )
}

function SidebarLogoBand() {
  return (
    <div
      className={cn(
        "relative hidden shrink-0 border-b border-zinc-200 lg:block",
        STAFF_HEADER_HEIGHT_CLASS,
      )}
    >
      <Link
        href="/dashboard"
        className="absolute inset-0 flex items-center justify-center px-2 py-3"
        aria-label="Manaratee home"
      >
        <div className="relative h-full w-full">
          <Image
            src="/Logo2.png"
            alt="Manaratee"
            fill
            sizes="180px"
            className="object-contain object-center"
            priority
          />
        </div>
      </Link>
    </div>
  )
}

function SidebarChromeSpacer() {
  return (
    <>
      <SidebarLogoBand />
      <div
        className={cn(
          "hidden shrink-0 border-b border-zinc-200 lg:block",
          STAFF_BREADCRUMB_ROW_HEIGHT_CLASS,
        )}
        aria-hidden
      />
    </>
  )
}

function SidebarContent() {
  return (
    <aside
      className={cn(
        "relative z-30 hidden h-screen shrink-0 flex-col border-r border-zinc-200 bg-white text-zinc-900 lg:flex",
        SIDEBAR_WIDTH_CLASS,
      )}
    >
      <SidebarChromeSpacer />
      <SidebarPrimaryNav />
    </aside>
  )
}

function SidebarFallback() {
  return (
    <aside
      className={cn(
        "relative z-30 hidden h-screen shrink-0 flex-col border-r border-zinc-200 bg-white text-zinc-900 lg:flex",
        SIDEBAR_WIDTH_CLASS,
      )}
    >
      <SidebarChromeSpacer />
      <nav className="flex flex-1 flex-col gap-2 px-2.5 pt-1">
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="h-14 animate-pulse rounded-lg bg-amber-50" />
        ))}
      </nav>
    </aside>
  )
}

export function Sidebar() {
  return (
    <Suspense fallback={<SidebarFallback />}>
      <SidebarContent />
    </Suspense>
  )
}

export function ModuleNavDrawer() {
  return (
    <Suspense fallback={null}>
      <ModuleNavDrawerContent />
    </Suspense>
  )
}

/** @deprecated Use ModuleNavDrawer */
export function ModuleSubNav() {
  return <ModuleNavDrawer />
}

function MobileSidebarContent() {
  const { mobileOpen, setMobileOpen, navItems, loading, openModuleDrawer } = useSidebarContext()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const profileListSegment = resolveContactProfileListSegment(pathname, searchParams)
  const [mobileModule, setMobileModule] = useState<NavItem | null>(null)

  useEffect(() => {
    if (!mobileOpen) {
      setMobileModule(null)
    }
  }, [mobileOpen])

  useEffect(() => {
    if (mobileOpen) {
      const active = findActiveModuleWithChildren(navItems, pathname, profileListSegment)
      setMobileModule(active)
    }
  }, [mobileOpen, navItems, pathname])

  function closeMobile() {
    setMobileOpen(false)
    setMobileModule(null)
  }

  function handlePrimaryClick(item: NavItem) {
    if (item.children && item.children.length > 0) {
      openModuleDrawer(item)
      setMobileModule(item)
      return
    }
    closeMobile()
  }

  const { grouped, footerItems } = groupNavItemsForDisplay(navItems)

  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent side="left" className="w-[280px] border-r border-zinc-200 bg-white p-0 text-zinc-900">
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>

        <div className="flex items-center justify-between border-b border-zinc-200 p-2">
          <div className="relative min-w-0 flex-1 pr-2">
            {mobileModule ? (
              <button
                type="button"
                onClick={() => setMobileModule(null)}
                className="flex h-[72px] items-center gap-2 text-sm font-medium text-zinc-700 hover:text-amber-700"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
            ) : (
              <div className="relative mx-auto aspect-square w-full max-w-[180px]">
                <Image
                  src="/Logo2.png"
                  alt="Manaratee"
                  fill
                  sizes="180px"
                  className="object-contain"
                  priority
                />
              </div>
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
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                {mobileModule.label}
              </p>
            </div>
            <SidebarSubNavLinks module={mobileModule} onNavigate={closeMobile} />
          </div>
        ) : (
          <nav className="max-h-[calc(100vh-88px)] overflow-y-auto px-3 pt-3 pb-4">
            {grouped.map((group, groupIndex) => (
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
                          isItemActive(item, pathname, navItems, profileListSegment)
                            ? "bg-amber-50 text-amber-700"
                            : "text-zinc-700 hover:bg-amber-50 hover:text-amber-700",
                        )}
                      >
                        {isItemActive(item, pathname, navItems, profileListSegment) ? (
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
                        isItemActive(item, pathname, navItems, profileListSegment)
                          ? "bg-amber-50 text-amber-700"
                          : "text-zinc-700 hover:bg-amber-50 hover:text-amber-700",
                      )}
                    >
                      {isItemActive(item, pathname, navItems, profileListSegment) ? (
                        <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-amber-600" />
                      ) : null}
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            ))}

            {footerItems.length > 0 ? (
              <div className="mt-5 border-t border-zinc-200 pt-3">
                {footerItems.map((item) => {
                  const hasChildren = Boolean(item.children && item.children.length > 0)

                  if (hasChildren) {
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => handlePrimaryClick(item)}
                        className={cn(
                          "relative flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                          isItemActive(item, pathname, navItems, profileListSegment)
                            ? "bg-amber-50 text-amber-700"
                            : "text-zinc-700 hover:bg-amber-50 hover:text-amber-700",
                        )}
                      >
                        {isItemActive(item, pathname, navItems, profileListSegment) ? (
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
                        isItemActive(item, pathname, navItems, profileListSegment)
                          ? "bg-amber-50 text-amber-700"
                          : "text-zinc-700 hover:bg-amber-50 hover:text-amber-700",
                      )}
                    >
                      {isItemActive(item, pathname, navItems, profileListSegment) ? (
                        <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-amber-600" />
                      ) : null}
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            ) : null}
          </nav>
        )}
      </SheetContent>
    </Sheet>
  )
}

export function MobileSidebar() {
  return (
    <Suspense fallback={null}>
      <MobileSidebarContent />
    </Suspense>
  )
}
