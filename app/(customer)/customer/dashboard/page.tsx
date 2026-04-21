"use client"

import Link from "next/link"
import { 
  CalendarDays, 
  Clock, 
  MapPin, 
  ArrowRight, 
  Plus, 
  Building2,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  ChevronRight
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookingStatusBadge, type BookingStatus } from "@/lib/status-badges"

// Venue-focused stats
const stats = [
  { 
    label: "Upcoming Bookings", 
    value: "2", 
    icon: CalendarDays, 
    description: "Confirmed venue reservations",
    accentColor: "bg-blue-50 text-blue-600 border-l-blue-500"
  },
  { 
    label: "Pending Approval", 
    value: "1", 
    icon: Clock, 
    description: "Awaiting venue confirmation",
    accentColor: "bg-amber-50 text-amber-600 border-l-amber-500"
  },
  { 
    label: "Balance Due", 
    value: "$2,940", 
    icon: DollarSign, 
    description: "Outstanding payments",
    accentColor: "bg-orange-50 text-orange-600 border-l-orange-500"
  },
  { 
    label: "Completed", 
    value: "5", 
    icon: CheckCircle2, 
    description: "Past venue rentals",
    accentColor: "bg-emerald-50 text-emerald-600 border-l-emerald-500"
  },
]

// Active and upcoming bookings
const myBookings = [
  { 
    id: "BK-2024-0042",
    venue: "Grand Hall", 
    eventType: "Wedding Reception",
    date: "Apr 15, 2026", 
    time: "2:00 PM - 10:00 PM",
    guests: 150,
    status: "Deposit Paid" as BookingStatus,
    totalAmount: 5500,
    balanceDue: 3850,
    depositPaid: true,
  },
  { 
    id: "BK-2024-0038",
    venue: "Garden Pavilion", 
    eventType: "Baby Shower",
    date: "Mar 28, 2026", 
    time: "10:00 AM - 4:00 PM",
    guests: 35,
    status: "Fully Paid" as BookingStatus,
    totalAmount: 1800,
    balanceDue: 0,
    depositPaid: true,
  },
  { 
    id: "BK-2024-0045",
    venue: "Grand Hall", 
    eventType: "Corporate Event",
    date: "May 10, 2026", 
    time: "9:00 AM - 5:00 PM",
    guests: 200,
    status: "Pending Review" as BookingStatus,
    totalAmount: 4200,
    balanceDue: 4200,
    depositPaid: false,
  },
]

// Payment reminders
const paymentReminders = [
  {
    id: "1",
    bookingId: "BK-2024-0042",
    venue: "Grand Hall",
    eventDate: "Apr 15, 2026",
    type: "Final Balance",
    amount: 3850,
    dueDate: "Apr 1, 2026",
    daysUntilDue: 8,
  },
]

// Recent activity
const recentActivity = [
  { id: "1", action: "Booking approved", booking: "BK-2024-0038", date: "Mar 18, 2026", time: "2:30 PM" },
  { id: "2", action: "Deposit payment received", booking: "BK-2024-0042", date: "Mar 15, 2026", time: "10:15 AM" },
  { id: "3", action: "Booking request submitted", booking: "BK-2024-0045", date: "Mar 22, 2026", time: "4:45 PM" },
]

export default function CustomerDashboardPage() {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Welcome header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome back, Sarah
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your venue bookings and upcoming events
          </p>
        </div>
        <Button asChild className="mt-4 sm:mt-0">
          <Link href="/customer/book-venue">
            <Plus className="mr-2 h-4 w-4" />
            Book a Venue
          </Link>
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className={`border-l-4 ${stat.accentColor.split(' ')[2]}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground truncate">{stat.label}</p>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                </div>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${stat.accentColor.split(' ')[0]}`}>
                  <stat.icon className={`h-5 w-5 ${stat.accentColor.split(' ')[1]}`} />
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground truncate">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* My Bookings - Takes 2 columns */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base font-semibold">My Bookings</CardTitle>
            <Button variant="ghost" size="sm" asChild className="text-xs">
              <Link href="/customer/bookings">
                View All
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 pt-0">
            {myBookings.map((booking) => (
              <Link 
                key={booking.id} 
                href={`/customer/bookings/${booking.id}`}
                className="group"
              >
                <div className="flex items-center justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50">
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Date box */}
                    <div className="hidden sm:flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10">
                      <span className="text-xs font-medium text-primary">
                        {booking.date.split(' ')[0]}
                      </span>
                      <span className="text-lg font-bold text-primary">
                        {booking.date.split(' ')[1].replace(',', '')}
                      </span>
                    </div>
                    
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{booking.eventType}</span>
                        <BookingStatusBadge status={booking.status} />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {booking.venue}
                        </span>
                        <span className="flex items-center gap-1 sm:hidden">
                          <CalendarDays className="h-3 w-3" />
                          {booking.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {booking.time}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-semibold">{formatCurrency(booking.totalAmount)}</p>
                      {booking.balanceDue > 0 && (
                        <p className="text-xs text-orange-600">
                          Balance: {formatCurrency(booking.balanceDue)}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                </div>
              </Link>
            ))}

            {myBookings.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-8">
                <Building2 className="h-10 w-10 text-muted-foreground/50" />
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">No bookings yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Book a venue for your next event
                  </p>
                </div>
                <Button size="sm" asChild>
                  <Link href="/customer/book-venue">
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Book a Venue
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column - Payment Reminders & Activity */}
        <div className="flex flex-col gap-4 sm:gap-6">
          {/* Payment Reminders */}
          {paymentReminders.length > 0 && (
            <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  Payment Due
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 pt-0">
                {paymentReminders.map((reminder) => (
                  <div key={reminder.id} className="rounded-lg bg-orange-50 border border-orange-200 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-orange-900">{reminder.type}</span>
                      <span className="text-sm font-bold text-orange-900">{formatCurrency(reminder.amount)}</span>
                    </div>
                    <div className="flex flex-col gap-1 text-xs text-orange-700">
                      <span>{reminder.venue} - {reminder.eventDate}</span>
                      <span className="font-medium">Due: {reminder.dueDate} ({reminder.daysUntilDue} days)</span>
                    </div>
                    <Button size="sm" className="w-full mt-3 bg-orange-600 hover:bg-orange-700" asChild>
                      <Link href={`/customer/bookings/${reminder.bookingId}`}>
                        <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                        Pay Now
                      </Link>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-col gap-3">
                {recentActivity.map((activity, index) => (
                  <div key={activity.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
                      {index < recentActivity.length - 1 && (
                        <div className="flex-1 w-px bg-border mt-1" />
                      )}
                    </div>
                    <div className="flex-1 pb-3">
                      <p className="text-sm font-medium">{activity.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {activity.booking} - {activity.date}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 flex flex-col gap-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/customer/book-venue">
                  <Building2 className="mr-2 h-4 w-4" />
                  Browse Venues
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/customer/venue-availability">
                  <CalendarDays className="mr-2 h-4 w-4" />
                  Check Availability
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/customer/bookings">
                  <Clock className="mr-2 h-4 w-4" />
                  View All Bookings
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
