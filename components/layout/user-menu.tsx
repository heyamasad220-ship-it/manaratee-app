"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Building2, Check, ChevronDown, LogOut, User } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { getBrowserAuthUser } from "@/lib/supabase/browser-auth-user"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { getCurrentOrganizationId } from "@/lib/current-organization"
import {
  HORIZON_DEMO_STAFF_DISPLAY_NAME,
  isHorizonDemoOrganization,
} from "@/lib/organizations/horizon-demo"
import {
  fetchUserPortalCapabilities,
} from "@/lib/auth/portal-capabilities-client"
import type { UserPortalCapabilities } from "@/lib/auth/portal-capabilities-types"
import { PortalSwitcher } from "@/components/portal/portal-switcher"

import { useStaffOrganizations } from "@/components/layout/staff-organization-switcher"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface UserProfile {
  full_name?: string | null
  email?: string | null
}

export function UserMenu() {
  const pathname = usePathname()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [organizationName, setOrganizationName] = useState<string | null>(null)
  const [portalCapabilities, setPortalCapabilities] =
    useState<UserPortalCapabilities | null>(null)
  const {
    organizations,
    currentOrganizationId,
    switchingId,
    error: organizationSwitchError,
    switchTo,
  } = useStaffOrganizations()

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function loadUser() {
      const user = await getBrowserAuthUser(supabase)
      if (cancelled || !user) return

      const { data: profileData } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .maybeSingle()

      if (cancelled) return

      const fullName = [profileData?.first_name, profileData?.last_name]
        .map((part) => String(part || "").trim())
        .filter(Boolean)
        .join(" ")

      setProfile({
        full_name: fullName || null,
        email: user.email || null,
      })

      const orgId = await getCurrentOrganizationId()
      if (cancelled) return

      if (orgId) {
        const { data: organization } = await supabase
          .from("organizations")
          .select("name")
          .eq("id", orgId)
          .maybeSingle()

        if (cancelled) return
        setOrganizationName((organization?.name as string | null)?.trim() || null)
      }

      const capabilities = await fetchUserPortalCapabilities(
        supabase,
        user.id,
        orgId
      )
      if (cancelled) return

      setPortalCapabilities(capabilities)
    }

    void loadUser()

    return () => {
      cancelled = true
    }
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  const displayName = isHorizonDemoOrganization(organizationName)
    ? HORIZON_DEMO_STAFF_DISPLAY_NAME
    : profile?.full_name?.trim() ||
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

      <DropdownMenuContent align="end" className="z-[100] w-64">
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

        {organizations.length > 1 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-2 font-normal text-muted-foreground">
              <Building2 className="h-4 w-4" />
              Organizations
            </DropdownMenuLabel>
            {organizations.map((organization) => {
              const isCurrent = organization.organizationId === currentOrganizationId
              return (
                <DropdownMenuItem
                  key={organization.organizationId}
                  disabled={switchingId !== null}
                  onSelect={(event) => {
                    event.preventDefault()
                    void switchTo(organization.organizationId)
                  }}
                >
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isCurrent ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{organization.organizationName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {switchingId === organization.organizationId
                        ? "Switching…"
                        : organization.roleLabel}
                    </span>
                  </span>
                </DropdownMenuItem>
              )
            })}
            {organizationSwitchError ? (
              <p className="px-2 py-1.5 text-xs text-destructive">
                {organizationSwitchError}
              </p>
            ) : null}
          </>
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
