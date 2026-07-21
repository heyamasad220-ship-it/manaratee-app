"use client"

import Link from "next/link"
import {
  Briefcase,
  GraduationCap,
  LayoutDashboard,
  User,
} from "lucide-react"

import type {
  PortalId,
  PortalOption,
  UserPortalCapabilities,
} from "@/lib/auth/portal-capabilities-types"
import { shouldShowPortalSwitcher } from "@/lib/auth/resolve-portal-permissions"
import { cn } from "@/lib/utils"

type PortalSwitcherProps = {
  capabilities: UserPortalCapabilities
  pathname: string
  variant?: "sidebar" | "compact"
}

function buildPortalOptions(
  capabilities: UserPortalCapabilities
): PortalOption[] {
  const options: PortalOption[] = []

  if (capabilities.hasPersonalPortal) {
    options.push({
      id: "member",
      label: "My Account",
      description: "Rentals, programs, donations",
      href: "/customer/dashboard",
    })
  }

  if (capabilities.hasStaffToolsPortal) {
    options.push({
      id: "staff",
      label: "Staff Tools",
      description: "Department event requests",
      href: "/customer/staff",
    })
  }

  if (capabilities.hasTeachingPortal) {
    options.push({
      id: "teaching",
      label: "My Classes",
      description: "Instructor assignments",
      href: "/my-classes",
    })
  }

  if (capabilities.hasAdminPortal) {
    options.push({
      id: "admin",
      label: "Admin Dashboard",
      description: "Organization management",
      href: "/dashboard",
    })
  }

  return options
}

export function getActivePortalId(pathname: string): PortalId {
  if (pathname.startsWith("/customer/staff")) {
    return "staff"
  }

  if (pathname.startsWith("/my-classes")) {
    return "teaching"
  }

  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/event-management") ||
    pathname.startsWith("/facilities") ||
    pathname.startsWith("/bookings") ||
    pathname.startsWith("/programs") ||
    pathname.startsWith("/workforce") ||
    pathname.startsWith("/settings")
  ) {
    return "admin"
  }

  if (pathname.startsWith("/customer")) {
    return "member"
  }

  return "member"
}

const PORTAL_ICONS = {
  member: User,
  staff: Briefcase,
  teaching: GraduationCap,
  admin: LayoutDashboard,
} as const

export function PortalSwitcher({
  capabilities,
  pathname,
  variant = "sidebar",
}: PortalSwitcherProps) {
  const options = buildPortalOptions(capabilities)

  if (!shouldShowPortalSwitcher(capabilities)) {
    return null
  }

  const activePortalId = getActivePortalId(pathname)

  if (variant === "compact") {
    return (
      <div className="flex flex-col gap-1">
        <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Switch portal
        </p>
        {options.map((option) => {
          const Icon = PORTAL_ICONS[option.id]
          const isActive = option.id === activePortalId

          return (
            <Link
              key={option.id}
              href={option.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {option.label}
            </Link>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Switch portal
      </p>
      <div className="grid gap-2">
        {options.map((option) => {
          const Icon = PORTAL_ICONS[option.id]
          const isActive = option.id === activePortalId

          return (
            <Link
              key={option.id}
              href={option.href}
              className={cn(
                "rounded-lg border px-3 py-2.5 transition",
                isActive
                  ? "border-primary/30 bg-primary/5"
                  : "border-border hover:bg-muted/50"
              )}
            >
              <div className="flex items-start gap-2">
                <Icon
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      isActive ? "text-primary" : "text-foreground"
                    )}
                  >
                    {option.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {option.description}
                  </p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
