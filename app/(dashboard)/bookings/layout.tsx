import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Venue Rentals",
}

export default function VenueRentalsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
