import Link from "next/link"

import { CommunityCalendarClient } from "@/components/vendor-hub/community-calendar/community-calendar-client"

export default function CommunityCalendarPage() {
  return (
    <>
      <div className="border-b border-border bg-card px-6 pt-6 pb-2">
        <nav className="mb-2 text-sm text-muted-foreground">
          <Link href="/vendor-hub" className="hover:text-foreground">
            Vendor Hub
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">Community Calendar</span>
        </nav>
      </div>
      <div className="p-6">
        <CommunityCalendarClient />
      </div>
    </>
  )
}
