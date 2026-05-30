"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  CalendarDays,
  Gift,
  Grid3X3,
  HeartHandshake,
  Home,
  LogOut,
  User,
} from "lucide-react"

import { OrganizationSwitcher } from "@/components/organization-switcher"
import { cn } from "@/lib/utils"

type CustomerOrganization = {
  organization_id: string
  organization_name: string
  role_name: string
}

type CustomerNavProps = {
  activeOrganization: CustomerOrganization | null
  organizations: CustomerOrganization[]
}

const navLinks = [
  { label: "Dashboard", href: "/customer/dashboard", icon: Home },
  { label: "Bookings", href: "/customer/bookings", icon: CalendarDays },
  { label: "Donations", href: "/customer/donation", icon: Gift },
  { label: "Programs", href: "/customer/programs", icon: HeartHandshake },
  { label: "Profile", href: "/customer/profile", icon: User },
  { label: "More", href: "/customer/more", icon: Grid3X3 },
]

export function CustomerNav({
  activeOrganization,
  organizations,
}: CustomerNavProps) {
  const pathname = usePathname()
  const portalRoleLabel = activeOrganization?.role_name || "Member"

  return (
    <aside className="hidden w-[260px] shrink-0 border-r border-border bg-card lg:flex lg:flex-col">
      <div className="border-b border-border px-6 py-6">
        <Link href="/customer/dashboard">
          <Image
            src="/logo.png"
            alt="Manaratee"
            width={220}
            height={80}
            className="h-auto w-full object-contain"
            priority
          />
        </Link>
      </div>

      {activeOrganization && organizations.length > 1 && (
        <div className="border-b border-border px-6 py-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Organization
          </p>

          <OrganizationSwitcher
            organizations={organizations}
            activeOrganizationId={activeOrganization.organization_id}
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <nav className="flex flex-col gap-1">
          {navLinks.map((link) => {
            const isActive =
              pathname === link.href || pathname.startsWith(`${link.href}/`)
            const Icon = link.icon

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{link.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="border-t border-border p-4">
        <div className="mb-4 flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {portalRoleLabel}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {activeOrganization?.organization_name || "Member portal"}
            </p>
          </div>
        </div>

        <Link
          href="/login"
          className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/10"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Link>
      </div>
    </aside>
  )
}