import type { Metadata } from "next"

import { requireOrganizationModule } from "@/lib/modules/dashboard-module-access-server"

export const metadata: Metadata = {
  title: "Venue Rentals",
}

export default async function VenueRentalsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireOrganizationModule("bookings")
  return children
}
