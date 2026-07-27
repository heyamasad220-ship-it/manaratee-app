"use client"

import { createContext, useContext } from "react"

import type { NavItem } from "@/lib/navigation/sidebar-nav"

export type StaffSidebarContextValue = {
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

/**
 * Kept in a small dedicated module so layout (SidebarProvider) and page
 * chunks (Header / MobileMenuTrigger) share one Context instance under Turbopack.
 */
export const StaffSidebarContext = createContext<StaffSidebarContextValue | null>(
  null
)

export function useSidebarContext() {
  const context = useContext(StaffSidebarContext)
  if (!context) {
    throw new Error("useSidebarContext must be used within SidebarProvider")
  }
  return context
}
