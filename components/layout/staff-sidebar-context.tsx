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

const STAFF_SIDEBAR_CONTEXT_KEY = "__manarateeStaffSidebarContext"

type GlobalWithStaffSidebar = typeof globalThis & {
  [STAFF_SIDEBAR_CONTEXT_KEY]?: ReturnType<
    typeof createContext<StaffSidebarContextValue | null>
  >
}

/**
 * Header and the dashboard layout are separate Turbopack chunks. Pin the
 * context on globalThis so both chunks share one React context object.
 */
function getStaffSidebarContext() {
  const root = globalThis as GlobalWithStaffSidebar
  const existing = root[STAFF_SIDEBAR_CONTEXT_KEY]
  if (existing) return existing
  const created = createContext<StaffSidebarContextValue | null>(null)
  root[STAFF_SIDEBAR_CONTEXT_KEY] = created
  return created
}

export const StaffSidebarContext = getStaffSidebarContext()

export function useSidebarContext() {
  const context = useContext(StaffSidebarContext)
  if (!context) {
    throw new Error("useSidebarContext must be used within SidebarProvider")
  }
  return context
}
