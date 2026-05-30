"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CalendarDays, ClipboardList, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

const tabs = [
  {
    label: "My Bookings",
    href: "/customer/bookings",
    icon: ClipboardList,
  },
  {
    label: "Book a Venue",
    href: "/customer/book-venue",
    icon: Plus,
  },
  {
    label: "Availability",
    href: "/customer/venue-availability",
    icon: CalendarDays,
  },
]

export function CustomerTabs() {
  const pathname = usePathname()

  return (
    <div className="mb-6 border-b border-border">
      <nav className="flex flex-wrap gap-1">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`)

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 border-b-2 border-transparent px-4 py-3 text-sm font-medium transition-colors",
                isActive
                  ? "border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}