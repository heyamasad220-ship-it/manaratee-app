"use client"

import type { ReactNode } from "react"
import { Suspense, useEffect, useState } from "react"
import Image from "next/image"

import { UserMenu } from "@/components/layout/user-menu"
import { MobileMenuTrigger } from "@/components/layout/sidebar"
import { NavigationBreadcrumbs } from "@/components/navigation/navigation-breadcrumbs"
import { STAFF_HEADER_HEIGHT_CLASS } from "@/lib/layout/staff-dashboard-chrome"
import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"

import { createClient } from "@/lib/supabase/client"
import { getCurrentOrganizationId } from "@/lib/current-organization"
import { cn } from "@/lib/utils"

interface HeaderProps {
  /** @deprecated Title is no longer shown in the top bar. Kept for call-site compatibility. */
  title?: string
  showSearch?: boolean
  actions?: ReactNode
}

export function Header({ showSearch = false, actions }: HeaderProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  useEffect(() => {
    async function loadOrganizationLogo() {
      try {
        const supabase = createClient()

        const orgId = await getCurrentOrganizationId()

        if (!orgId) return

        const { data, error } = await supabase
          .from("organizations")
          .select("logo_url")
          .eq("id", orgId)
          .single()

        if (error) {
          console.error("Error loading organization logo:", error)
          return
        }

        setLogoUrl(data?.logo_url || null)
      } catch (err) {
        console.error("Header logo error:", err)
      }
    }

    loadOrganizationLogo()
  }, [])

  return (
    <div className="sticky top-0 z-50 shrink-0">
      <header
        className={cn(
          "flex shrink-0 items-center gap-4 border-b border-border bg-card/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:px-6",
          STAFF_HEADER_HEIGHT_CLASS,
        )}
      >
        <div className="mr-auto flex min-w-0 items-center gap-3 lg:mr-0">
          <MobileMenuTrigger />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          {actions}
          {showSearch && (
            <div className="relative hidden md:flex">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <Input placeholder="Search..." className="h-9 w-[200px] pl-9 lg:w-[280px]" />
            </div>
          )}

          {logoUrl ? (
            <div className="flex items-center justify-center overflow-hidden rounded-md border bg-white p-1">
              <Image
                src={logoUrl}
                alt="Organization Logo"
                width={40}
                height={40}
                className="h-9 w-auto max-w-[140px] object-contain"
              />
            </div>
          ) : null}

          <UserMenu />
        </div>
      </header>
      <Suspense fallback={null}>
        <NavigationBreadcrumbs />
      </Suspense>
    </div>
  )
}
