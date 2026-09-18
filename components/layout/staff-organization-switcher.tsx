"use client"

import { useEffect, useState } from "react"
import { Building2, Check, ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { clearSelectedOrganizationIdCache, getCurrentOrganizationId } from "@/lib/current-organization"
import {
  listStaffOrganizationsAction,
  switchStaffOrganizationAction,
  type StaffOrganizationOption,
} from "@/lib/organizations/staff-organization-switch"
import { cn } from "@/lib/utils"

export function useStaffOrganizations() {
  const [organizations, setOrganizations] = useState<StaffOrganizationOption[]>([])
  const [currentOrganizationId, setCurrentOrganizationId] = useState<string | null>(null)
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [orgs, orgId] = await Promise.all([
          listStaffOrganizationsAction(),
          getCurrentOrganizationId(),
        ])
        if (cancelled) return
        setOrganizations(orgs)
        setCurrentOrganizationId(orgId)
      } catch (loadError) {
        console.warn("Could not load staff organizations:", loadError)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  async function switchTo(organizationId: string) {
    if (!organizationId || organizationId === currentOrganizationId) return

    setError(null)
    setSwitchingId(organizationId)

    const result = await switchStaffOrganizationAction(organizationId)

    if (!result.success) {
      setSwitchingId(null)
      setError(result.error)
      return
    }

    clearSelectedOrganizationIdCache()
    window.location.assign("/dashboard")
  }

  return {
    organizations,
    currentOrganizationId,
    switchingId,
    error,
    switchTo,
  }
}

export function StaffOrganizationHeaderSwitcher({
  fallbackName,
}: {
  fallbackName?: string | null
}) {
  const { organizations, currentOrganizationId, switchingId, error, switchTo } =
    useStaffOrganizations()
  const current = organizations.find(
    (organization) => organization.organizationId === currentOrganizationId
  )
  const displayName = current?.organizationName || fallbackName?.trim() || null

  if (!displayName) return null

  if (organizations.length <= 1) {
    return (
      <p className="hidden max-w-[10rem] truncate text-sm font-semibold leading-tight text-foreground sm:block sm:max-w-[14rem] lg:max-w-[18rem] lg:text-base">
        {displayName}
      </p>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="hidden h-auto max-w-[10rem] gap-1 px-2 py-1 text-sm font-semibold leading-tight text-foreground hover:bg-accent sm:inline-flex sm:max-w-[14rem] lg:max-w-[18rem] lg:text-base"
          aria-label="Switch organization"
          title={displayName}
        >
          <span className="truncate">{displayName}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[100] w-64 animate-none">
        <DropdownMenuLabel>Switch organization</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {organizations.map((organization) => {
          const isCurrent = organization.organizationId === currentOrganizationId
          return (
            <DropdownMenuItem
              key={organization.organizationId}
              disabled={switchingId !== null}
              onSelect={() => {
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
        {error ? (
          <p className="px-2 py-1.5 text-xs text-destructive">{error}</p>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

