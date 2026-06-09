"use client"

import Link from "next/link"
import { Building2 } from "lucide-react"

import type { ContactRentalRecord, ContactRentalStats } from "@/lib/contacts/contact-profile-data"
import { formatContactDate } from "@/lib/contacts/contact-profile-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type ContactRentalsPanelProps = {
  rentalStats: ContactRentalStats
  rentals: ContactRentalRecord[]
  showPanel: boolean
}

export function ContactRentalsPanel({
  rentalStats,
  rentals,
  showPanel,
}: ContactRentalsPanelProps) {
  if (!showPanel) return null

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Building2 className="size-5 text-orange-600" />
            <h2 className="text-lg font-semibold">Venue Rentals</h2>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/bookings/requests">View all rentals</Link>
          </Button>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Total rentals</p>
            <p className="text-lg font-semibold">{rentalStats.rentalCount}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last rental</p>
            <p className="font-medium">{formatContactDate(rentalStats.lastRentalDate)}</p>
          </div>
        </div>

        {rentals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No venue rentals linked to this contact yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Event</th>
                  <th className="px-3 py-2 font-medium">Spaces</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rentals.map((rental) => (
                  <tr key={rental.id} className="border-b last:border-0">
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatContactDate(rental.date)}
                    </td>
                    <td className="px-3 py-2">{rental.eventTypeName || "Venue rental"}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {rental.spacesSummary || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary">{rental.statusLabel}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button variant="link" size="sm" className="h-auto p-0" asChild>
                        <Link href={`/bookings/rentals/${rental.id}`}>View</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
