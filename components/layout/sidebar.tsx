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
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { createClient } from "@/lib/supabase/client"

interface SubItem {
  label: string
  href: string
  matchPrefix: string
  permissionKey?: string
}

interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  matchPrefix: string
  children?: SubItem[]
  group?: string | null
  permissionKey?: string
}

interface SidebarModuleRow {
  name: string
  slug: string
  route: string | null
  icon_name: string | null
  group_name: string | null
  sort_order: number | null
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
}

const modulePermissionMap: Record<string, string> = {
  programs: "programs.view",
  donations: "donations.view",
  hr: "staff.view",
  staff: "staff.view",
  applications: "applications.view",
  contacts: "contacts.view",
  reports: "reports.view",
  ticketing: "ticketing.view",
  bookings: "bookings.view",
  spaces: "spaces.view",
  "vendor-hub": "vendor_hub.view",
}

const moduleChildren: Record<string, SubItem[]> = {
  ticketing: [
    { label: "Overview", href: "/events/tickets", matchPrefix: "/events/tickets", permissionKey: "ticketing.view" },
    { label: "Settings", href: "/tickets/settings", matchPrefix: "/tickets/settings", permissionKey: "ticketing.manage" },
  ],
  bookings: [
    { label: "Dashboard", href: "/bookings/overview", matchPrefix: "/bookings/overview", permissionKey: "bookings.view" },
    { label: "Calendar", href: "/events/new", matchPrefix: "/events/new", permissionKey: "bookings.manage" },
    { label: "Requests", href: "/events/external/emails", matchPrefix: "/events/external/emails", permissionKey: "bookings.manage" },
  ],
  spaces: [
    { label: "Overview", href: "/events/external/venues", matchPrefix: "/events/external/venues", permissionKey: "spaces.view" },
    { label: "Settings", href: "/bookings/settings", matchPrefix: "/bookings/settings", permissionKey: "spaces.manage" },
  ],
  programs: [
    { label: "Catalog", href: "/programs/catalog", matchPrefix: "/programs/catalog", permissionKey: "programs.view" },
    { label: "Registrations", href: "/programs/registrations", matchPrefix: "/programs/registrations", permissionKey: "programs.manage" },
    { label: "Schedule", href: "/programs/schedule", matchPrefix: "/programs/schedule", permissionKey: "programs.view" },
    { label: "Staff Management", href: "/programs/instructors", matchPrefix: "/programs/instructors", permissionKey: "staff.view" },
    { label: "Reports", href: "/programs/reports", matchPrefix: "/programs/reports", permissionKey: "reports.view" },
    { label: "Settings", href: "/programs/settings", matchPrefix: "/programs/settings", permissionKey: "programs.manage" },
  ],
  "vendor-hub": [
    { label: "Overview", href: "/vendor-hub", matchPrefix: "/vendor-hub", permissionKey: "vendor_hub.view" },
    { label: "Vendors", href: "/vendor-hub/vendors", matchPrefix: "/vendor-hub/vendors", permissionKey: "vendor_hub.manage" },
    { label: "Applications", href: "/vendor-hub/applications", matchPrefix: "/vendor-hub/applications", permissionKey: "vendor_hub.manage" },
    { label: "Booths", href: "/vendor-hub/booths", matchPrefix: "/vendor-hub/booths", permissionKey: "vendor_hub.manage" },
    { label: "Activities", href: "/vendor-hub/activities", matchPrefix: "/vendor-hub/activities", permissionKey: "vendor_hub.manage" },
    { label: "Entertainment", href: "/vendor-hub/entertainment", matchPrefix: "/vendor-hub/entertainment", permissionKey: "vendor_hub.manage" },
    { label: "Payments", href: "/vendor-hub/payments", matchPrefix: "/vendor-hub/payments", permissionKey: "vendor_hub.manage" },
    { label: "Community Calendar", href: "/vendor-hub/community-calendar", matchPrefix: "/vendor-hub/community-calendar", permissionKey: "vendor_hub.view" },
    { label: "Reports", href: "/vendor-hub/reports", matchPrefix: "/vendor-hub/reports", permissionKey: "reports.view" },
    { label: "Settings", href: "/vendor-hub/settings", matchPrefix: "/vendor-hub/settings", permissionKey: "vendor_hub.manage" },
  ],
  contacts: [
    { label: "All Contacts", href: "/contacts", matchPrefix: "/contacts", permissionKey: "contacts.view" },
  ],
  donations: [
    { label: "Overview", href: "/donations", matchPrefix: "/donations", permissionKey: "donations.view" },
    { label: "Payments", href: "/donations/payments", matchPrefix: "/donations/payments", permissionKey: "donations.view" },
    { label: "Pledges", href: "/donations/pledges", matchPrefix: "/donations/pledges", permissionKey: "donations.view" },
    { label: "Import", href: "/donations/import", matchPrefix: "/donations/import", permissionKey: "donations.manage" },
    { label: "Reconcile", href: "/donations/reconcile", matchPrefix: "/donations/reconcile", permissionKey: "donations.manage" },
    { label: "Reports", href: "/donations/reports", matchPrefix: "/donations/reports", permissionKey: "reports.view" },
    { label: "Settings", href: "/donations/settings", matchPrefix: "/donations/settings", permissionKey: "donations.manage" },
  ],
hr: [
  {
    label: "Members",
    href: "/hr/members",
    matchPrefix: "/hr/members",
    permissionKey: "staff.view",
  },
  {
    label: "Employees",
    href: "/hr/employees",
    matchPrefix: "/hr/employees",
    permissionKey: "staff.view",
  },
  {
    label: "Volunteers",
    href: "/resources/volunteers",
    matchPrefix: "/resources/volunteers",
    permissionKey: "staff.view",
  },
  {
    label: "Discount Policies",
    href: "/hr/discount-policies",
    matchPrefix: "/hr/discount-policies",
    permissionKey: "staff.view",
  },
],
}

function userCanAccess(permissionContext: UserPermissionContext, permissionKey?: string) {
  if (!permissionKey) return true
  if (permissionContext.isOwner) return true
  return permissionContext.enabledPermissions.has(permissionKey)
}

function filterNavItemsByPermissions(items: NavItem[], permissionContext: UserPermissionContext): NavItem[] {
  return items
    .filter((item) => userCanAccess(permissionContext, item.permissionKey))
    .map((item) => ({
      ...item,
      children: item.children?.filter((child) => userCanAccess(permissionContext, child.permissionKey)),
    }))
    .filter((item) => !(item.children && item.children.length === 0 && item.href === "#"))
}

function buildNavItems(rows: SidebarModuleRow[], permissionContext: UserPermissionContext): NavItem[] {
  const dynamicItems: NavItem[] = rows
    .filter((row) => row.route)
    .map((row) => {
      const href = row.route || "/dashboard"
      const iconName = row.icon_name || "Boxes"
      const Icon = iconMap[iconName] || Boxes
      return {
        label: row.name,
        href,
        icon: Icon,
        matchPrefix: href,
        group: row.group_name,
        permissionKey: modulePermissionMap[row.slug],
        children: moduleChildren[row.slug] || [
          { label: "Overview", href, matchPrefix: href, permissionKey: modulePermissionMap[row.slug] },
        ],
      }
    })

  const allItems: NavItem[] = [
    { label: "Org Admin", href: "/dashboard", icon: Home, matchPrefix: "/dashboard" },
    ...dynamicItems,
    {
      label: "Settings",
      href: "/settings",
      icon: Settings,
      matchPrefix: "/settings",
      group: "System",
      children: [
        { label: "Users", href: "/settings/users", matchPrefix: "/settings/users", permissionKey: "settings.users.view" },
        { label: "Applications", href: "/settings/applications", matchPrefix: "/settings/applications", permissionKey: "applications.view" },
        { label: "Templates", href: "/settings/templates", matchPrefix: "/settings/templates", permissionKey: "settings.templates.view" },
        { label: "Email Settings", href: "/settings/email", matchPrefix: "/settings/email", permissionKey: "settings.email.view" },
        { label: "Roles & Permissions", href: "/settings/roles-permissions", matchPrefix: "/settings/roles-permissions", permissionKey: "settings.roles.view" },
      ],
    },
  ]

  return filterNavItemsByPermissions(allItems, permissionContext)
}

interface SidebarContextType {
  mobileOpen: boolean
  setMobileOpen: (open: boolean) => void
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
  return <SidebarContext.Provider value={{ mobileOpen, setMobileOpen }}>{children}</SidebarContext.Provider>
}

export function MobileMenuTrigger() {
  const { setMobileOpen } = useSidebarContext()
  return (
    <Button variant="ghost" size="icon" className="h-10 w-10 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
      <Menu className="h-5 w-5" />
    </Button>
  )
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const [navItems, setNavItems] = useState<NavItem[]>([{ label: "Org Admin", href: "/dashboard", icon: Home, matchPrefix: "/dashboard" }])
  const [loading, setLoading] = useState(true)
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function loadSidebarModules() {
      setLoading(true)
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setNavItems([{ label: "Org Admin", href: "/dashboard", icon: Home, matchPrefix: "/dashboard" }])
        setLoading(false)
        return
      }

      const { data: membership, error: membershipError } = await supabase
        .from("organization_members")
        .select("organization_id, role, role_id")
        .eq("user_id", user.id)
        .maybeSingle()

      if (membershipError || !membership) {
        console.error("Error loading organization membership:", membershipError)
        setNavItems([{ label: "Org Admin", href: "/dashboard", icon: Home, matchPrefix: "/dashboard" }])
        setLoading(false)
        return
      }

      let permissionContext: UserPermissionContext = {
        isOwner: membership.role === "owner",
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

      // my_sidebar_modules remains the subscription/module source.
      // Unsubscribed modules are hidden by that view first.
      const { data, error } = await supabase
        .from("my_sidebar_modules")
        .select("name, slug, route, icon_name, group_name, sort_order")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true })

      if (error) {
        console.error("Error loading sidebar modules:", error)
        setNavItems(
          filterNavItemsByPermissions(
            [
              { label: "Org Admin", href: "/dashboard", icon: Home, matchPrefix: "/dashboard" },
              {
                label: "Settings",
                href: "/settings",
                icon: Settings,
                matchPrefix: "/settings",
                group: "System",
                children: [
                  { label: "Users", href: "/settings/users", matchPrefix: "/settings/users", permissionKey: "settings.users.view" },
                  { label: "Applications", href: "/settings/applications", matchPrefix: "/settings/applications", permissionKey: "applications.view" },
                  { label: "Roles & Permissions", href: "/settings/roles-permissions", matchPrefix: "/settings/roles-permissions", permissionKey: "settings.roles.view" },
                ],
              },
            ],
            permissionContext,
          ),
        )
      } else {
        setNavItems(buildNavItems(data || [], permissionContext))
      }

      setLoading(false)
    }

    loadSidebarModules()
  }, [])

  useEffect(() => {
    const initial: Record<string, boolean> = {}
    navItems.forEach((item) => {
      if (item.children && isItemActive(item)) initial[item.label] = true
    })
    setOpenMenus((prev) => ({ ...initial, ...prev }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, navItems.length])

  const isItemActive = (item: NavItem) => {
    const matchesSelf = pathname.startsWith(item.matchPrefix)
    const matchesChild = item.children?.some((child) => pathname.startsWith(child.matchPrefix)) ?? false
    const isOverridden = navItems.some(
      (other) =>
        other.label !== item.label &&
        other.matchPrefix.startsWith(item.matchPrefix) &&
        other.matchPrefix.length > item.matchPrefix.length &&
        pathname.startsWith(other.matchPrefix),
    )
    return (matchesSelf && !isOverridden) || matchesChild
  }

  function toggleMenu(label: string) {
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  const groupedItems: { group: string | null; items: NavItem[] }[] = []
  let currentGroup: string | null | undefined = undefined

  navItems.forEach((item) => {
    const itemGroup = item.group ?? null
    if (groupedItems.length === 0 || itemGroup !== currentGroup) {
      groupedItems.push({ group: itemGroup, items: [item] })
      currentGroup = itemGroup
    } else {
      groupedItems[groupedItems.length - 1].items.push(item)
    }
  })

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
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pt-3 pb-4">
      {groupedItems.map((group, groupIndex) => (
        <div key={`${group.group ?? "main"}-${groupIndex}`} className={groupIndex > 0 ? "mt-5" : ""}>
          {group.group && <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{group.group}</div>}

          {group.items.map((item) => {
            const isActive = isItemActive(item)
            const isOpen = openMenus[item.label] ?? false

            if (item.children && item.children.length > 0) {
              return (
                <div key={item.label}>
                  <button
                    type="button"
                    onClick={() => toggleMenu(item.label)}
                    className={cn(
                      "relative flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive ? "bg-amber-50 text-amber-700" : "text-zinc-700 hover:bg-amber-50 hover:text-amber-700",
                    )}
                  >
                    {isActive && <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-amber-600" />}
                    <item.icon className="h-[18px] w-[18px] shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform duration-200", isOpen && "rotate-180")} />
                  </button>

                  {isOpen && (
                    <div className="ml-[30px] flex flex-col gap-0.5 border-l border-amber-100 pl-3 pt-1 pb-1">
                      {item.children.map((child) => {
                        const isChildOverridden = item.children!.some(
                          (other) =>
                            other.label !== child.label &&
                            other.matchPrefix.startsWith(child.matchPrefix) &&
                            other.matchPrefix.length > child.matchPrefix.length &&
                            pathname.startsWith(other.matchPrefix),
                        )
                        const isChildActive = pathname.startsWith(child.matchPrefix) && !isChildOverridden

                        return (
                          <Link
                            key={child.label}
                            href={child.href}
                            onClick={onNavigate}
                            className={cn(
                              "flex min-h-[40px] items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                              isChildActive ? "bg-amber-50 text-amber-700" : "text-zinc-600 hover:bg-amber-50 hover:text-amber-700",
                            )}
                          >
                            {child.label}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "relative flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive ? "bg-amber-50 text-amber-700" : "text-zinc-700 hover:bg-amber-50 hover:text-amber-700",
                )}
              >
                {isActive && <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-amber-600" />}
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

function SidebarHeader() {
  return (
    <div className="flex items-center justify-center border-b border-zinc-200 px-4 py-6">
      <Image src="/logo.png" alt="Manaratee" width={180} height={80} className="h-auto w-[160px] object-contain" priority />
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="hidden h-screen w-[240px] shrink-0 flex-col border-r border-zinc-200 bg-white text-zinc-900 lg:flex">
      <SidebarHeader />
      <SidebarNav />
    </aside>
  )
}

export function MobileSidebar() {
  const { mobileOpen, setMobileOpen } = useSidebarContext()

  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent side="left" className="w-[280px] border-r border-zinc-200 bg-white p-0 text-zinc-900">
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>

        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <Image src="/logo.png" alt="Manaratee" width={160} height={70} className="h-auto w-[140px] object-contain" priority />

          <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-700 hover:bg-amber-50 hover:text-amber-700" onClick={() => setMobileOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <SidebarNav onNavigate={() => setMobileOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}
