"use client"

import { useState, useEffect, createContext, useContext } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CalendarDays,
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
  BookOpen,
  Menu,
  X,
  Ticket,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import type { LucideIcon } from "lucide-react"

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
  children?: SubItem[]
  group?: string
}

const navItems: NavItem[] = [
  // Main
  { label: "Dashboard", href: "/dashboard", icon: Home, matchPrefix: "/dashboard" },
  
  
  // Operations
  /*
  {
    label: "Ticketing",
    href: "/events/tickets",
    icon: Ticket,
    matchPrefix: "/events/tickets",
    group: "Operations",
    children: [
      { label: "Overview", href: "/events/tickets", matchPrefix: "/events/tickets" },
      { label: "Settings", href: "/tickets/settings", matchPrefix: "/tickets/settings" },
    ],
  },
  */
 /*
  {
    label: "Bookings",
    href: "/bookings/overview",
    icon: Calendar,
    matchPrefix: "/bookings",
    group: "Operations",
    children: [
      { label: "Dashboard", href: "/bookings/overview", matchPrefix: "/bookings/overview" },
      { label: "Calendar", href: "/events/new", matchPrefix: "/events/new" },
      { label: "Requests", href: "/events/external/emails", matchPrefix: "/events/external/emails" },
    ],
  },
  */
 /*
  {
    label: "Spaces",
    href: "/events/external/venues",
    icon: Building2,
    matchPrefix: "/events/external/venues",
    group: "Operations",
    children: [
      { label: "Overview", href: "/events/external/venues", matchPrefix: "/events/external/venues" },
      { label: "Settings", href: "/bookings/settings", matchPrefix: "/bookings/settings" },
    ],
  },
  */
 /*
  {
    label: "Programs",
    href: "/programs",
    icon: GraduationCap,
    matchPrefix: "/programs",
    group: "Operations",
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
  */
 /*
  {
    label: "Bazaar",
    href: "/bazaar",
    icon: Store,
    matchPrefix: "/bazaar",
    group: "Operations",
    children: [
      { label: "Overview", href: "/bazaar", matchPrefix: "/bazaar" },
      { label: "Vendors", href: "/bazaar/vendors", matchPrefix: "/bazaar/vendors" },
      { label: "Applications", href: "/bazaar/applications", matchPrefix: "/bazaar/applications" },
      { label: "Booths", href: "/bazaar/booths", matchPrefix: "/bazaar/booths" },
      { label: "Activities", href: "/bazaar/activities", matchPrefix: "/bazaar/activities" },
      { label: "Food Trucks", href: "/bazaar/food-trucks", matchPrefix: "/bazaar/food-trucks" },
      { label: "Entertainment", href: "/bazaar/entertainment", matchPrefix: "/bazaar/entertainment" },
      { label: "Payments", href: "/bazaar/payments", matchPrefix: "/bazaar/payments" },
      { label: "Community Calendar", href: "/bazaar/community-calendar", matchPrefix: "/bazaar/community-calendar" },
      { label: "Reports", href: "/bazaar/reports", matchPrefix: "/bazaar/reports" },
      { label: "Settings", href: "/bazaar/settings", matchPrefix: "/bazaar/settings" },
    ],
  },
  */

  // People
  {
    label: "Contacts",
    href: "/contacts",
    icon: Users,
    matchPrefix: "/contacts",
    group: "People",
    children: [
      { label: "All Contacts", href: "/contacts", matchPrefix: "/contacts" },
      { label: "Customers", href: "/contacts/customers", matchPrefix: "/contacts/customers" },
      { label: "Volunteers", href: "/contacts/volunteers", matchPrefix: "/contacts/volunteers" },
      { label: "Vendors", href: "/contacts/vendors", matchPrefix: "/contacts/vendors" },
      { label: "Service Providers", href: "/contacts/service-providers", matchPrefix: "/contacts/service-providers" },
      { label: "Donors", href: "/donations/donors", matchPrefix: "/donations/donors" },
    ],
  },
  /*
  {
    label: "Human Resources",
    href: "/hr",
    icon: Users,
    matchPrefix: "/hr",
    group: "People",
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
  */

  // Financial
  {
    label: "Donations",
    href: "/donations",
    icon: Heart,
    matchPrefix: "/donations",
    group: "Financial",
    children: [
      { label: "Overview", href: "/donations", matchPrefix: "/donations" },
      { label: "Payments", href: "/donations/payments", matchPrefix: "/donations/payments" },
      { label: "Donors", href: "/donations/donors", matchPrefix: "/donations/donors" },
      { label: "Pledges", href: "/donations/pledges", matchPrefix: "/donations/pledges" },
      { label: "Import", href: "/donations/import", matchPrefix: "/donations/import" },
      { label: "Reconcile", href: "/donations/reconcile", matchPrefix: "/donations/reconcile" },
      { label: "Reports", href: "/donations/reports", matchPrefix: "/donations/reports" },
      { label: "Settings", href: "/donations/settings", matchPrefix: "/donations/settings" },
    ],
  },
  /*
  {
    label: "Billing",
    href: "/billing",
    icon: CreditCard,
    matchPrefix: "/billing",
    group: "Financial",
    children: [
      { label: "Overview", href: "/billing", matchPrefix: "/billing" },
      { label: "Venue Payments", href: "/events/external/payments", matchPrefix: "/events/external/payments" },
    ],
  },
  */

  // System
  /*
  {
    label: "Reports",
    href: "/reports",
    icon: LayoutGrid,
    matchPrefix: "/reports",
    group: "System",
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
  */
]

// Sidebar context for mobile state
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

// Mobile menu trigger button for header
export function MobileMenuTrigger() {
  const { setMobileOpen } = useSidebarContext()
  
  return (
    <Button
      variant="ghost"
      size="icon"
      className="lg:hidden h-10 w-10"
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
    const matchesChild = item.children?.some((child) => pathname.startsWith(child.matchPrefix)) ?? false
    const isOverridden = navItems.some(
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
    navItems.forEach((item) => {
      if (item.children && isItemActive(item)) {
        initial[item.label] = true
      }
    })
    return initial
  })

  function toggleMenu(label: string) {
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  // Group items by their group property
  const groupedItems: { group: string | null; items: NavItem[] }[] = []
  let currentGroup: string | undefined = undefined
  
  navItems.forEach((item) => {
    const itemGroup = item.group ?? null
    if (groupedItems.length === 0 || itemGroup !== currentGroup) {
      groupedItems.push({ group: itemGroup, items: [item] })
      currentGroup = itemGroup ?? undefined
    } else {
      groupedItems[groupedItems.length - 1].items.push(item)
    }
  })

  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pt-2 pb-4">
      {groupedItems.map((group, groupIndex) => (
        <div key={group.group ?? "main"} className={groupIndex > 0 ? "mt-4" : ""}>
          {group.group && (
            <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted/70">
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
                  "relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-primary" />
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
                <div className="ml-[30px] flex flex-col gap-0.5 border-l border-border pl-3 pt-1 pb-1">
                  {item.children.map((child) => {
                    const isChildOverridden = item.children!.some(
                      (other) =>
                        other.label !== child.label &&
                        other.matchPrefix.startsWith(child.matchPrefix) &&
                        other.matchPrefix.length > child.matchPrefix.length &&
                        pathname.startsWith(other.matchPrefix)
                    )
                    const isChildActive = pathname.startsWith(child.matchPrefix) && !isChildOverridden
                    return (
                      <Link
                        key={child.label}
                        href={child.href}
                        onClick={onNavigate}
                        className={cn(
                          "rounded-md px-3 py-2 text-sm font-medium transition-colors min-h-[40px] flex items-center",
                          isChildActive
                            ? "text-sidebar-accent-foreground"
                            : "text-sidebar-muted hover:text-sidebar-foreground"
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
              "relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            {isActive && (
              <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-primary" />
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
    <div className="flex items-center gap-2.5 px-5 py-5">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
        <span className="text-sm font-bold text-primary-foreground">M</span>
      </div>
      <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
        Manaratee
      </span>
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
      <aside className="hidden lg:flex h-screen w-[240px] shrink-0 flex-col bg-sidebar-bg text-sidebar-foreground">
        <SidebarHeader />
        <nav className="flex flex-1 flex-col gap-2 px-3 pt-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-11 animate-pulse rounded-md bg-sidebar-accent/30" />
          ))}
        </nav>
      </aside>
    )
  }

  return (
    <aside className="hidden lg:flex h-screen w-[240px] shrink-0 flex-col bg-sidebar-bg text-sidebar-foreground">
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
        className="w-[280px] p-0 bg-sidebar-bg text-sidebar-foreground border-r-0"
      >
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
              <span className="text-sm font-bold text-primary-foreground">M</span>
            </div>
            <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
              Manaratee
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
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
