import { Header } from "@/components/layout/header"
import { BookingsTabNav } from "@/components/layout/bookings-tab-nav"
import { PlaceholderPage } from "@/components/layout/placeholder-page"

export default function ExternalBookingsOverviewPage() {
  return (
    <>
      <Header title="Bookings - External" />
      <BookingsTabNav />
      <PlaceholderPage
        title="External Bookings"
        description="External booking management. Coming soon."
      />
    </>
  )
}
