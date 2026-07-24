"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

/** Legacy nav — Programs Settings now lives on each department. */
const settingsTabs = [
  {
    label: "Departments",
    href: "/workforce?tab=departments",
    isActive: (pathname: string) =>
      pathname.startsWith("/workforce") || pathname.startsWith("/programs/settings"),
  },
] as const

export function ProgramsSettingsNav() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 border-b border-border">
      {settingsTabs.map((tab) => {
        const isActive = tab.isActive(pathname)

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
