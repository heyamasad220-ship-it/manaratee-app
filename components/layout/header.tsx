"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import Image from "next/image"

import { UserMenu } from "@/components/layout/user-menu"
import { MobileMenuTrigger } from "@/components/layout/sidebar"
import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { createClient } from "@/lib/supabase/client"
import { getCurrentOrganizationId } from "@/lib/current-organization"

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
    <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center justify-end gap-4 border-b border-border bg-card/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:h-16 sm:px-6">
      <div className="mr-auto lg:hidden">
        <MobileMenuTrigger />
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {actions}
        {showSearch && (
          <div className="hidden md:flex relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

            <Input
              placeholder="Search..."
              className="w-[200px] lg:w-[280px] pl-9 h-9"
            />
          </div>
        )}

        {logoUrl && (
          <div className="flex items-center justify-center overflow-hidden rounded-md border bg-white p-1">
            <Image
              src={logoUrl}
              alt="Organization Logo"
              width={40}
              height={40}
              className="h-8 w-auto object-contain"
            />
          </div>
        )}

        <UserMenu />
      </div>
    </header>
  )
}