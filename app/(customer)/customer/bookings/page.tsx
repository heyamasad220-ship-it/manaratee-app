"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Calendar,
  Clock,
  MapPin,
  Plus,
  ChevronRight,
} from "lucide-react"
import { BookingStatusBadge, type BookingStatus } from "@/lib/status-badges"

// Mock bookings data
const mockBookings = [
  {
    id: "BK-2024-0042",
    venue: "Grand Hall",
    date: "2024-04-15",
    startTime: "2:00 PM",
    endTime: "10:00 PM",
    eventType: "Wedding Reception",
    status: "Deposit Pending" as const,
    totalAmount: 5500,
    balanceDue: 5500,
  },
  {
    id: "BK-2024-0038",
    venue: "Garden Pavilion",
    date: "2024-03-20",
    startTime: "10:00 AM",
    endTime: "4:00 PM",
    eventType: "Baby Shower",
    status: "Fully Paid" as const,
    totalAmount: 1800,
    balanceDue: 0,
  },
  {
    id: "BK-2024-0025",
    venue: "Grand Hall",
    date: "2024-02-10",
    startTime: "6:00 PM",
    endTime: "11:00 PM",
    eventType: "Corporate Event",
    status: "Deposit Paid" as const,
    totalAmount: 4200,
    balanceDue: 2940,
  },
]

export default function CustomerBookingsPage() {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Bookings</h1>
            <p className="text-muted-foreground">View and manage your venue bookings</p>
          </div>
          <Button asChild>
            <Link href="/customer/book-venue">
              <Plus className="mr-2 h-4 w-4" />
              New Booking
            </Link>
          </Button>
        </div>

        {/* Bookings List */}
        <div className="flex flex-col gap-4">
          {mockBookings.map((booking) => (
            <Link key={booking.id} href={`/customer/bookings/${booking.id}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                      {/* Date Box */}
                      <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10">
                        <span className="text-xs font-medium text-primary">
                          {new Date(booking.date).toLocaleDateString("en-US", { month: "short" })}
                        </span>
                        <span className="text-2xl font-bold text-primary">
                          {new Date(booking.date).getDate()}
                        </span>
                      </div>

                      {/* Booking Info */}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{booking.eventType}</h3>
                          <BookingStatusBadge status={booking.status as BookingStatus} />
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {booking.venue}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(booking.date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {booking.startTime} - {booking.endTime}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Booking ID: {booking.id}
                        </p>
                      </div>
                    </div>

                    {/* Amount & Arrow */}
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Total</p>
                        <p className="font-semibold">{formatCurrency(booking.totalAmount)}</p>
                        {booking.balanceDue > 0 && (
                          <p className="text-xs text-orange-600">
                            Balance: {formatCurrency(booking.balanceDue)}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Empty State (hidden when bookings exist) */}
        {mockBookings.length === 0 && (
          <Card className="p-12 text-center">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No bookings yet</h3>
            <p className="mt-2 text-muted-foreground">
              Start by booking a venue for your next event
            </p>
            <Button className="mt-6" asChild>
              <Link href="/customer/book-venue">
                <Plus className="mr-2 h-4 w-4" />
                Book a Venue
              </Link>
            </Button>
          </Card>
        )}
      </div>
    </div>
  )
}
