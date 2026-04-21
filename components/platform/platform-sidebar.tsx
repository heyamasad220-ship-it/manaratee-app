"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Banknote,
  Users,
  ScrollText,
  ShieldCheck,
  LogOut,
  Boxes,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard, matchPrefix: "/admin/dashboard" },
  { label: "Organizations", href: "/admin/organizations", icon: Building2, matchPrefix: "/admin/organizations" },
  { label: "Plans", href: "/admin/plans", icon: CreditCard, matchPrefix: "/admin/plans" },
  { label: "Payments", href: "/admin/payments", icon: Banknote, matchPrefix: "/admin/payments" },
  { label: "Modules", href: "/admin/modules", icon: Boxes, matchPrefix: "/admin/modules" },
  { label: "Settings", href: "/admin/settings", icon: Settings, matchPrefix: "/admin/settings" },
  { label: "Users", href: "/admin/users", icon: Users, matchPrefix: "/admin/users" },
  { label: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText, matchPrefix: "/admin/audit-logs" },
]

export function PlatformSidebar() {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <aside className="flex h-screen w-[220px] shrink-0 flex-col bg-zinc-950 text-zinc-100">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <span className="text-base font-semibold tracking-tight text-zinc-100">
            Platform Admin
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-2 px-3 pt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-md bg-zinc-800/50" />
          ))}
        </nav>
      </aside>
    )
  }

  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col bg-zinc-950 text-zinc-100">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600">
          <ShieldCheck className="h-4 w-4 text-white" />
        </div>
        <span className="text-base font-semibold tracking-tight text-zinc-100">
          Platform Admin
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3 pt-2">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.matchPrefix)
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-emerald-500" />
              )}
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-zinc-800 px-3 py-3">
        <div className="flex items-center gap-3 rounded-md px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-zinc-300">
            SA
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-zinc-200">Super Admin</p>
            <p className="truncate text-xs text-zinc-500">admin@manaratee.com</p>
          </div>
          <Link href="/admin/login" className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <LogOut className="h-4 w-4" />
            <span className="sr-only">Logout</span>
          </Link>
        </div>
      </div>
    </aside>
  )
}
