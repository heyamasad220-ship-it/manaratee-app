"use client"

import type { ReactNode } from "react"
import { Suspense, useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"

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
  /** Appended after the nav trail (e.g. department name on HR → Departments). */
  breadcrumbExtras?: Array<{ label: string; href?: string }>
}

export function Header({ showSearch = false, actions, breadcrumbExtras }: HeaderProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [organizationName, setOrganizationName] = useState<string | null>(null)

  useEffect(() => {
    async function loadOrganizationBranding() {
      try {
        const supabase = createClient()

        const orgId = await getCurrentOrganizationId()

        if (!orgId) return

        const { data, error } = await supabase
          .from("organizations")
          .select("name, logo_url")
          .eq("id", orgId)
          .maybeSingle()

        if (error) {
          // PostgREST errors often stringify as `{}` in the Next overlay — log fields explicitly.
          // Missing/unreadable org rows are expected (no logo); skip noisy console errors.
          const message =
            typeof error.message === "string" ? error.message.trim() : ""
          if (message) {
            console.warn(
              "Error loading organization branding:",
              error.code ?? "unknown",
              message
            )
          }
          return
        }

        setOrganizationName((data?.name as string | null)?.trim() || null)
        setLogoUrl(data?.logo_url || null)
      } catch (err) {
        console.warn("Header branding error:", err)
      }
    }

    void loadOrganizationBranding()
  }, [])

  return (
    <div className="sticky top-0 z-50 shrink-0">
      <header
        className={cn(
          "flex shrink-0 items-center gap-4 border-b border-border bg-card/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:px-6",
          STAFF_HEADER_HEIGHT_CLASS,
        )}
      >
        <div className="mr-auto flex min-w-0 items-center gap-3">
          <MobileMenuTrigger />
          <Link
            href="/dashboard"
            prefetch={false}
            className="flex min-w-0 items-center py-1"
            aria-label="Manaratee home"
          >
            <Image
              src="/Logo2.png"
              alt="Manaratee"
              width={720}
              height={180}
              priority
              className="h-16 w-auto max-w-[min(100%,22rem)] object-contain object-left sm:h-24 sm:max-w-[26rem] lg:h-[7.5rem] lg:max-w-[32rem]"
            />
          </Link>
        </div>

        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
          {actions}
          {showSearch && (
            <div className="relative hidden md:flex">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <Input placeholder="Search..." className="h-9 w-[200px] pl-9 lg:w-[280px]" />
            </div>
          )}

          {organizationName || logoUrl ? (
            <div className="flex min-w-0 items-center gap-2.5">
              {organizationName ? (
                <p className="hidden max-w-[10rem] truncate text-sm font-semibold leading-tight text-foreground sm:block sm:max-w-[14rem] lg:max-w-[18rem] lg:text-base">
                  {organizationName}
                </p>
              ) : null}
              {logoUrl ? (
                <div className="flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white p-1">
                  <Image
                    src={logoUrl}
                    alt={organizationName || "Organization logo"}
                    width={40}
                    height={40}
                    className="h-9 w-auto max-w-[140px] object-contain"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <UserMenu />
        </div>
      </header>
      <Suspense fallback={null}>
        <NavigationBreadcrumbs extras={breadcrumbExtras} />
      </Suspense>
    </div>
  )
}
