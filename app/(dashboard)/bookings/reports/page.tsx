"use client"

import { Header } from "@/components/layout/header"
import { BookingsTabNav } from "@/components/layout/bookings-tab-nav"
import { PlaceholderPage } from "@/components/layout/placeholder-page"

export default function BookingsReportsPage() {
  return (
    <>
      <Header title="Reports" />
      <BookingsTabNav />
      <div className="p-6">
        <PlaceholderPage
          title="Reports"
          description="Booking reports and analytics. Coming soon."
        />
      </div>
    </>
  )
}
