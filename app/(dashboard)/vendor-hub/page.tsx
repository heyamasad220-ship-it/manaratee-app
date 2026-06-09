"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Store,
  Users,
  Utensils,
  Sparkles,
  Music,
  TrendingUp,
  Calendar,
  MapPin,
  Clock,
  Plus,
  FileText,
  DollarSign,
  Send,
  Globe,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { CreateBazaarEventDrawer } from "@/components/bazaar/create-bazaar-event-drawer"


const upcomingDeadlines: any[] = []

export default function VendorHubOverviewPage() {
  const [selectedEventId, setSelectedEventId] = useState("")
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false)
  const supabase = createClient()

const [vendorHubEvents, setVendorHubEvents] = useState<any[]>([])

useEffect(() => {
  const fetchEvents = async () => {
    const { data, error } = await supabase
      .from("vendor_hub_events")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error loading vendor events:", error)
      return
    }

    const formattedEvents = (data || []).map((event) => ({
      id: event.id,
      name: event.name,
      date: event.event_date,
      time: event.start_time,
      location: event.location,

      expectedAttendees: event.expected_attendees ?? 0,

      booths: {
        total: event.total_booths ?? 0,
        assigned: 0,
        available: event.total_booths ?? 0,
      },

      vendors: {
        total: 0,
        approved: 0,
        pending: 0,
      },

      foodTrucks: 0,
      activities: 0,
      entertainment: 0,

      status: event.status,
      calendarStatus: event.calendar_status,
    }))

    setVendorHubEvents(formattedEvents)

    if (formattedEvents.length > 0) {
      setSelectedEventId(formattedEvents[0].id)
    }
  }

  fetchEvents()
}, [])

  const selectedEvent = vendorHubEvents.find((event) => event.id === selectedEventId) || null

  const stats = [
    {
      label: "Total Booths",
      value: selectedEvent?.booths?.total ?? 0,
      subtext: `${selectedEvent?.booths?.assigned ?? 0} assigned`,
      icon: Store,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      label: "Vendors",
      value: selectedEvent?.vendors?.total ?? 0,
      subtext: `${selectedEvent?.vendors?.pending ?? 0} pending approval`,
      icon: Users,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      label: "Food Trucks",
      value: selectedEvent?.foodTrucks ?? 0,
      subtext: "Registered",
      icon: Utensils,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      label: "Activities",
      value: selectedEvent?.activities ?? 0,
      subtext: "Scheduled",
      icon: Sparkles,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      label: "Entertainment",
      value: selectedEvent?.entertainment ?? 0,
      subtext: "Performers",
      icon: Music,
      color: "text-pink-600",
      bgColor: "bg-pink-50",
    },
    {
      label: "Expected Attendance",
      value: selectedEvent?.expectedAttendees?.toLocaleString?.() ?? 0,
      subtext: "Attendees",
      icon: TrendingUp,
      color: "text-cyan-600",
      bgColor: "bg-cyan-50",
    },
  ]

  return (
    <>
      <Header title="Overview" />

      <div className="p-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Select
                value={selectedEventId}
                onValueChange={setSelectedEventId}
                disabled={vendorHubEvents.length === 0}
              >
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="No vendor events yet" />
                </SelectTrigger>

                <SelectContent>
                  {vendorHubEvents.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Badge variant="outline" className="border-muted bg-muted text-muted-foreground">
                {selectedEvent ? "Event Selected" : "No Event Selected"}
              </Badge>
            </div>

            <Button onClick={() => setCreateDrawerOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Vendor Event
            </Button>

            <CreateBazaarEventDrawer
  open={createDrawerOpen}
  onOpenChange={setCreateDrawerOpen}
  eventData={selectedEvent}
/>
          </div>

          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold text-foreground">
                  {selectedEvent?.name ?? "No vendor event selected"}
                </h2>

                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    {selectedEvent?.date ?? "Date not set"}
                  </span>

                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {selectedEvent?.location ?? "Location not set"}
                  </span>

                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    {selectedEvent?.time ?? "Time not set"}
                  </span>
                </div>
              </div>

              <Button
  variant="outline"
  size="sm"
  disabled={!selectedEvent}
  onClick={() => setCreateDrawerOpen(true)}
>
  Edit Event Details
</Button>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-4 [&>*]:w-fit">
            {stats.map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">{stat.value}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{stat.subtext}</p>
                    </div>

                    <div className={cn("rounded-lg p-2", stat.bgColor)}>
                      <stat.icon className={cn("h-5 w-5", stat.color)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
              <CardDescription>Common tasks for managing your vendor event</CardDescription>
            </CardHeader>

            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Link href="/vendor-hub/applications">
                  <Button variant="outline" className="gap-2">
                    <FileText className="h-4 w-4" />
                    Review Applications
                  </Button>
                </Link>

                <Link href="/vendor-hub/booths">
                  <Button variant="outline" className="gap-2">
                    <Store className="h-4 w-4" />
                    Assign Booths
                  </Button>
                </Link>

                <Link href="/vendor-hub/payments">
                  <Button variant="outline" className="gap-2">
                    <DollarSign className="h-4 w-4" />
                    Record Vendor Payment
                  </Button>
                </Link>

                <Link href="/vendor-hub/community-calendar">
                  <Button variant="outline" className="gap-2">
                    <Globe className="h-4 w-4" />
                    Publish to Community Calendar
                  </Button>
                </Link>

                <Button variant="outline" className="gap-2">
                  <Send className="h-4 w-4" />
                  Message Vendors
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upcoming Deadlines</CardTitle>
              <CardDescription>Key dates to remember</CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-3">
              {upcomingDeadlines.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No upcoming deadlines yet.
                </div>
              ) : (
                upcomingDeadlines.map((deadline) => (
                  <div
                    key={deadline.id}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3",
                      deadline.daysLeft <= 3 && "border-red-200 bg-red-50"
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 rounded-full p-1.5",
                        deadline.daysLeft <= 3 ? "bg-red-100" : "bg-muted"
                      )}
                    >
                      {deadline.type === "application" && (
                        <FileText
                          className={cn(
                            "h-4 w-4",
                            deadline.daysLeft <= 3 ? "text-red-600" : "text-muted-foreground"
                          )}
                        />
                      )}

                      {deadline.type === "payment" && (
                        <DollarSign
                          className={cn(
                            "h-4 w-4",
                            deadline.daysLeft <= 3 ? "text-red-600" : "text-muted-foreground"
                          )}
                        />
                      )}

                      {deadline.type === "booth" && (
                        <Store
                          className={cn(
                            "h-4 w-4",
                            deadline.daysLeft <= 3 ? "text-red-600" : "text-muted-foreground"
                          )}
                        />
                      )}

                      {deadline.type === "publish" && (
                        <Globe
                          className={cn(
                            "h-4 w-4",
                            deadline.daysLeft <= 3 ? "text-red-600" : "text-muted-foreground"
                          )}
                        />
                      )}
                    </div>

                    <div className="flex-1">
                      <p className={cn("text-sm font-medium", deadline.daysLeft <= 3 && "text-red-700")}>
                        {deadline.title}
                      </p>
                      <p className={cn("text-xs", deadline.daysLeft <= 3 ? "text-red-600" : "text-muted-foreground")}>
                        {deadline.date} ({deadline.daysLeft} days left)
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}