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
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"

interface SubItem {
  label: string
  href: string
  matchPrefix: string
}

interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  matchPrefix: string
  enabled: boolean
  children?: SubItem[]
  group?: string
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: Home,
    matchPrefix: "/dashboard",
    enabled: true,
  },

  {
    label: "Ticketing",
    href: "/events/tickets",
    icon: Ticket,
    matchPrefix: "/events/tickets",
    group: "Operations",
    enabled: true,
    children: [
      { label: "Overview", href: "/events/tickets", matchPrefix: "/events/tickets" },
      { label: "Settings", href: "/tickets/settings", matchPrefix: "/tickets/settings" },
    ],
  },
  {
    label: "Bookings",
    href: "/bookings/overview",
    icon: Calendar,
    matchPrefix: "/bookings",
    group: "Operations",
    enabled: true,
    children: [
      { label: "Dashboard", href: "/bookings/overview", matchPrefix: "/bookings/overview" },
      { label: "Calendar", href: "/events/new", matchPrefix: "/events/new" },
      { label: "Requests", href: "/events/external/emails", matchPrefix: "/events/external/emails" },
    ],
  },
  {
    label: "Spaces",
    href: "/events/external/venues",
    icon: Building2,
    matchPrefix: "/events/external/venues",
    group: "Operations",
    enabled: true,
    children: [
      { label: "Overview", href: "/events/external/venues", matchPrefix: "/events/external/venues" },
      { label: "Settings", href: "/bookings/settings", matchPrefix: "/bookings/settings" },
    ],
  },
  {
    label: "Programs",
    href: "/programs",
    icon: GraduationCap,
    matchPrefix: "/programs",
    group: "Operations",
    enabled: true,
    children: [
      { label: "Overview", href: "/programs", matchPrefix: "/programs" },
      { label: "Catalog", href: "/programs/catalog", matchPrefix: "/programs/catalog" },
      { label: "Registrations", href: "/programs/registrations", matchPrefix: "/programs/registrations" },
      { label: "Schedule", href: "/programs/schedule", matchPrefix: "/programs/schedule" },
      { label: "Instructors", href: "/programs/instructors", matchPrefix: "/programs/instructors" },
      { label: "Reports", href: "/programs/reports", matchPrefix: "/programs/reports" },
      { label: "Settings", href: "/programs/settings", matchPrefix: "/programs/settings" },
    ],
  },
  {
    label: "Vendor Hub",
    href: "/vendor-hub",
    icon: Store,
    matchPrefix: "/vendor-hub",
    group: "Operations",
    enabled: true,
    children: [
      { label: "Overview", href: "/vendor-hub", matchPrefix: "/vendor-hub" },
      { label: "Vendors", href: "/vendor-hub/vendors", matchPrefix: "/vendor-hub/vendors" },
      { label: "Applications", href: "/vendor-hub/applications", matchPrefix: "/vendor-hub/applications" },
      { label: "Booths", href: "/vendor-hub/booths", matchPrefix: "/vendor-hub/booths" },
      { label: "Activities", href: "/vendor-hub/activities", matchPrefix: "/vendor-hub/activities" },
      { label: "Entertainment", href: "/vendor-hub/entertainment", matchPrefix: "/vendor-hub/entertainment" },
      { label: "Payments", href: "/vendor-hub/payments", matchPrefix: "/vendor-hub/payments" },
      { label: "Community Calendar", href: "/vendor-hub/community-calendar", matchPrefix: "/vendor-hub/community-calendar" },
      { label: "Reports", href: "/vendor-hub/reports", matchPrefix: "/vendor-hub/reports" },
      { label: "Settings", href: "/vendor-hub/settings", matchPrefix: "/vendor-hub/settings" },
    ],
  },

  {
    label: "Contacts",
    href: "/contacts",
    icon: Users,
    matchPrefix: "/contacts",
    group: "People",
    enabled: true,
    children: [
      { label: "All Contacts", href: "/contacts", matchPrefix: "/contacts" },
      
    ],
  },
  {
    label: "Human Resources",
    href: "/hr",
    icon: Users,
    matchPrefix: "/hr",
    group: "People",
    enabled: false,
    children: [
      { label: "Overview", href: "/hr", matchPrefix: "/hr" },
      { label: "Employees", href: "/hr/employees", matchPrefix: "/hr/employees" },
      { label: "Members", href: "/hr/members", matchPrefix: "/hr/members" },
      { label: "Departments", href: "/hr/departments", matchPrefix: "/hr/departments" },
      { label: "Discount Policies", href: "/hr/discount-policies", matchPrefix: "/hr/discount-policies" },
      { label: "Reports", href: "/hr/reports", matchPrefix: "/hr/reports" },
      { label: "Settings", href: "/hr/settings", matchPrefix: "/hr/settings" },
    ],
  },

  {
    label: "Donations",
    href: "/donations",
    icon: Heart,
    matchPrefix: "/donations",
    group: "Financial",
    enabled: true,
    children: [
      { label: "Overview", href: "/donations", matchPrefix: "/donations" },
      { label: "Payments", href: "/donations/payments", matchPrefix: "/donations/payments" },
      { label: "Pledges", href: "/donations/pledges", matchPrefix: "/donations/pledges" },
      { label: "Import", href: "/donations/import", matchPrefix: "/donations/import" },
      { label: "Import History", href: "/donations/import-history", matchPrefix: "/donations/import-history" },
      { label: "Reconcile", href: "/donations/reconcile", matchPrefix: "/donations/reconcile" },
      { label: "Reports", href: "/donations/reports", matchPrefix: "/donations/reports" },
      { label: "Settings", href: "/donations/settings", matchPrefix: "/donations/settings" },
    ],
  },
  {
    label: "Billing",
    href: "/billing",
    icon: CreditCard,
    matchPrefix: "/billing",
    group: "Financial",
    enabled: false,
    children: [
      { label: "Overview", href: "/billing", matchPrefix: "/billing" },
      { label: "Venue Payments", href: "/events/external/payments", matchPrefix: "/events/external/payments" },
    ],
  },

  {
    label: "Reports",
    href: "/reports",
    icon: LayoutGrid,
    matchPrefix: "/reports",
    group: "System",
    enabled: true,
    children: [
      { label: "Overview", href: "/reports", matchPrefix: "/reports" },
      { label: "Internal Events", href: "/events/reports", matchPrefix: "/events/reports" },
      { label: "Venue Rentals", href: "/events/external/reports", matchPrefix: "/events/external/reports" },
    ],
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    matchPrefix: "/settings",
    group: "System",
    enabled: true,
    children: [
      { label: "Users", href: "/settings/users", matchPrefix: "/settings/users" },
      { label: "Applications", href: "/settings/applications", matchPrefix: "/settings/applications" },
      { label: "Templates", href: "/settings/templates", matchPrefix: "/settings/templates" },
      { label: "Email Settings", href: "/settings/email", matchPrefix: "/settings/email" },
      { label: "Roles & Permissions", href: "/settings/roles-permissions", matchPrefix: "/settings/roles-permissions" },
      { label: "Internal Events", href: "/events/settings", matchPrefix: "/events/settings" },
      { label: "Venue Rentals", href: "/events/external/settings", matchPrefix: "/events/external/settings" },
    ],
  },
]

const enabledNavItems = navItems.filter((item) => item.enabled)

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

  return (
    <SidebarContext.Provider value={{ mobileOpen, setMobileOpen }}>
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

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  const isItemActive = (item: NavItem) => {
    const matchesSelf = pathname.startsWith(item.matchPrefix)
    const matchesChild =
      item.children?.some((child) => pathname.startsWith(child.matchPrefix)) ??
      false

    const isOverridden = enabledNavItems.some(
      (other) =>
        other.label !== item.label &&
        other.matchPrefix.startsWith(item.matchPrefix) &&
        other.matchPrefix.length > item.matchPrefix.length &&
        pathname.startsWith(other.matchPrefix)
    )

    return (matchesSelf && !isOverridden) || matchesChild
  }

  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}

    enabledNavItems.forEach((item) => {
      if (item.children && isItemActive(item)) {
        initial[item.label] = true
      }
    })

    return initial
  })

  function toggleMenu(label: string) {
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  const groupedItems: { group: string | null; items: NavItem[] }[] = []
  let currentGroup: string | null | undefined = undefined

  enabledNavItems.forEach((item) => {
    const itemGroup = item.group ?? null

    if (groupedItems.length === 0 || itemGroup !== currentGroup) {
      groupedItems.push({ group: itemGroup, items: [item] })
      currentGroup = itemGroup
    } else {
      groupedItems[groupedItems.length - 1].items.push(item)
    }
  })

  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pt-3 pb-4">
      {groupedItems.map((group, groupIndex) => (
        <div key={group.group ?? "main"} className={groupIndex > 0 ? "mt-5" : ""}>
          {group.group && (
            <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              {group.group}
            </div>
          )}

          {group.items.map((item) => {
            const isActive = isItemActive(item)
            const isOpen = openMenus[item.label] ?? false

            if (item.children) {
              return (
                <div key={item.label}>
                  <button
                    type="button"
                    onClick={() => toggleMenu(item.label)}
                    className={cn(
                      "relative flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-amber-50 text-amber-700"
                        : "text-zinc-700 hover:bg-amber-50 hover:text-amber-700"
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-amber-600" />
                    )}

                    <item.icon className="h-[18px] w-[18px] shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>

                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 transition-transform duration-200",
                        isOpen && "rotate-180"
                      )}
                    />
                  </button>

                  {isOpen && (
                    <div className="ml-[30px] flex flex-col gap-0.5 border-l border-amber-100 pl-3 pt-1 pb-1">
                      {item.children.map((child) => {
                        const isChildOverridden = item.children!.some(
                          (other) =>
                            other.label !== child.label &&
                            other.matchPrefix.startsWith(child.matchPrefix) &&
                            other.matchPrefix.length > child.matchPrefix.length &&
                            pathname.startsWith(other.matchPrefix)
                        )

                        const isChildActive =
                          pathname.startsWith(child.matchPrefix) &&
                          !isChildOverridden

                        return (
                          <Link
                            key={child.label}
                            href={child.href}
                            onClick={onNavigate}
                            className={cn(
                              "flex min-h-[40px] items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                              isChildActive
                                ? "bg-amber-50 text-amber-700"
                                : "text-zinc-600 hover:bg-amber-50 hover:text-amber-700"
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
                  isActive
                    ? "bg-amber-50 text-amber-700"
                    : "text-zinc-700 hover:bg-amber-50 hover:text-amber-700"
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-amber-600" />
                )}

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
      <Image
        src="/logo.png"
        alt="Manaratee"
        width={180}
        height={80}
        className="h-auto w-[160px] object-contain"
        priority
      />
    </div>
  )
}

export function Sidebar() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <aside className="hidden h-screen w-[240px] shrink-0 flex-col border-r border-zinc-200 bg-white text-zinc-900 lg:flex">
        <SidebarHeader />
        <nav className="flex flex-1 flex-col gap-2 px-3 pt-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-11 animate-pulse rounded-lg bg-amber-50" />
          ))}
        </nav>
      </aside>
    )
  }

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
      <SheetContent
        side="left"
        className="w-[280px] border-r border-zinc-200 bg-white p-0 text-zinc-900"
      >
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>

        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <Image
            src="/logo.png"
            alt="Manaratee"
            width={160}
            height={70}
            className="h-auto w-[140px] object-contain"
            priority
          />

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-700 hover:bg-amber-50 hover:text-amber-700"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <SidebarNav onNavigate={() => setMobileOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}