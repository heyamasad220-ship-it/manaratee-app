"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import Image from "next/image"
import {
  LayoutDashboard,
  Building2,
  Banknote,
  Users,
  ScrollText,
  LogOut,
  Boxes,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard, matchPrefix: "/admin/dashboard" },
  { label: "Organizations", href: "/admin/organizations", icon: Building2, matchPrefix: "/admin/organizations" },
  { label: "Payments", href: "/admin/payments", icon: Banknote, matchPrefix: "/admin/payments" },
  { label: "Modules", href: "/admin/modules", icon: Boxes, matchPrefix: "/admin/modules" },
  { label: "Settings", href: "/admin/settings", icon: Settings, matchPrefix: "/admin/settings" },
  { label: "Users", href: "/admin/users", icon: Users, matchPrefix: "/admin/users" },
  { label: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText, matchPrefix: "/admin/audit-logs" },
]

export function PlatformSidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r border-zinc-200 bg-white text-zinc-900">
      <div className="flex items-center justify-center px-4 py-5">
        <Image
          src="/logo.png"
          alt="Manaratee"
          width={180}
          height={60}
          className="h-auto w-auto object-contain"
          priority
        />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3 pt-2">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.matchPrefix)
          const className = cn(
            "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            isActive
              ? "bg-amber-50 text-amber-700"
              : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          )

          return (
            <Link
              key={item.label}
              href={item.href}
              prefetch={false}
              aria-current={isActive ? "page" : undefined}
              className={className}
            >
              {isActive && (
                <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-black" />
              )}
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-zinc-200 px-3 py-3">
        <div className="flex items-center gap-3 rounded-md px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-xs font-bold text-zinc-700">
            SA
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-800">Super Admin</p>
            <p className="truncate text-xs text-zinc-500">admin@manaratee.com</p>
          </div>
          <Link
            href="/admin/login"
            prefetch={false}
            className="text-zinc-500 transition-colors hover:text-zinc-800"
          >
            <LogOut className="h-4 w-4" />
            <span className="sr-only">Logout</span>
          </Link>
        </div>
      </div>
    </aside>
  )
}
