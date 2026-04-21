"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

interface CustomersTabNavProps {
  customerId: string
}

export function CustomersTabNav({ customerId }: CustomersTabNavProps) {
  const pathname = usePathname()

  const tabs = [
    { label: "Profile", href: `/people/${customerId}/profile` },
    { label: "Family", href: `/people/${customerId}/family` },
    { label: "Subscriptions", href: `/people/${customerId}/subscriptions` },
    { label: "Transactions", href: `/people/${customerId}/transactions` },
    { label: "Bookings", href: `/people/${customerId}/bookings` },
  ]

  return (
    <nav className="flex gap-0 overflow-x-auto border-b border-border">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "relative px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors",
              isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
