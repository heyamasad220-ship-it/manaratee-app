"use client"

import { Menu } from "lucide-react"

import { useSidebarContext } from "@/components/layout/staff-sidebar-context"
import { Button } from "@/components/ui/button"

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
