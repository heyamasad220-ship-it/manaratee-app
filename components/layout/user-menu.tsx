"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, LogOut, User } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { getCurrentOrganizationId } from "@/lib/current-organization"
import {
  fetchUserPortalCapabilities,
} from "@/lib/auth/portal-capabilities-client"
import type { UserPortalCapabilities } from "@/lib/auth/portal-capabilities-types"
import { PortalSwitcher } from "@/components/portal/portal-switcher"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface UserProfile {
  full_name?: string | null
  email?: string | null
}

export function UserMenu() {
  const supabase = createClient()
  const pathname = usePathname()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [portalCapabilities, setPortalCapabilities] =
    useState<UserPortalCapabilities | null>(null)

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle()

      setProfile({
        full_name: profileData?.full_name || null,
        email: user.email || null,
      })

      const orgId = await getCurrentOrganizationId()
      const capabilities = await fetchUserPortalCapabilities(
        supabase,
        user.id,
        orgId
      )
      setPortalCapabilities(capabilities)
    }

    loadUser()
  }, [supabase])

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  const displayName =
    profile?.full_name ||
    profile?.email?.split("@")[0] ||
    "User"

  const initials = displayName
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="gap-2 px-2 py-1 text-sm text-foreground hover:bg-accent"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>

          <span className="font-medium">{displayName}</span>

          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem asChild>
          <Link href="/profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile
          </Link>
        </DropdownMenuItem>

        {portalCapabilities ? (
          <div className="px-2 py-2">
            <PortalSwitcher
              capabilities={portalCapabilities}
              pathname={pathname}
              variant="compact"
            />
          </div>
        ) : null}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleLogout}
          className="flex items-center gap-2 text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
