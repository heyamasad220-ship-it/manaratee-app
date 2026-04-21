"use client"

import { useState } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  DollarSign,
  Send,
  Globe,
  ClipboardList,
  CalendarCheck,
  CreditCard,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { CreateBazaarEventDrawer } from "@/components/bazaar/create-bazaar-event-drawer"

// Mock bazaar events
const bazaarEvents = [
  {
    id: "bz-1",
    name: "Annual Community Bazaar 2026",
    date: "March 15, 2026",
    location: "Main Hall & Outdoor Area",
    status: "upcoming",
    booths: { total: 50, assigned: 42, available: 8 },
    vendors: { total: 38, approved: 32, pending: 6 },
    activities: 12,
    foodTrucks: 8,
    entertainment: 5,
    expectedAttendees: 2500,
  },
  {
    id: "bz-2",
    name: "Ramadan Night Market",
    date: "March 22, 2026",
    location: "Outdoor Courtyard",
    status: "planning",
    booths: { total: 30, assigned: 15, available: 15 },
    vendors: { total: 20, approved: 12, pending: 8 },
    activities: 6,
    foodTrucks: 12,
    entertainment: 3,
    expectedAttendees: 1500,
  },
  {
    id: "bz-3",
    name: "Eid Celebration Bazaar",
    date: "April 10, 2026",
    location: "Full Campus",
    status: "draft",
    booths: { total: 75, assigned: 0, available: 75 },
    vendors: { total: 0, approved: 0, pending: 0 },
    activities: 0,
    foodTrucks: 0,
    entertainment: 0,
    expectedAttendees: 5000,
  },
]

// Mock workflow data
const workflowData = {
  pendingApplications: 6,
  approvedVendors: 32,
  unpaidVendorFees: 8,
  boothsRemaining: 8,
  calendarStatus: "published",
}

// Mock upcoming deadlines
const upcomingDeadlines = [
  { id: "dl-1", title: "Vendor Application Deadline", date: "March 5, 2026", daysLeft: 6, type: "application" },
  { id: "dl-2", title: "Payment Deadline", date: "March 10, 2026", daysLeft: 11, type: "payment" },
  { id: "dl-3", title: "Booth Assignment Deadline", date: "March 12, 2026", daysLeft: 13, type: "booth" },
  { id: "dl-4", title: "Event Publish to Calendar", date: "March 1, 2026", daysLeft: 2, type: "publish" },
]

// Mock recent vendor applications
const recentApplications = [
  { id: "va-1", vendor: "Halal Eats Co.", type: "Food", boothType: "Food Booth", status: "pending", date: "Feb 28, 2026" },
  { id: "va-2", vendor: "Islamic Arts & Crafts", type: "Retail", boothType: "Standard", status: "approved", date: "Feb 27, 2026" },
  { id: "va-3", vendor: "Modest Fashion Hub", type: "Clothing", boothType: "Premium", status: "pending", date: "Feb 26, 2026" },
  { id: "va-4", vendor: "Kids Fun Zone", type: "Activity", boothType: "Activity Space", status: "approved", date: "Feb 25, 2026" },
  { id: "va-5", vendor: "Baklava Paradise", type: "Food", boothType: "Food Booth", status: "rejected", date: "Feb 24, 2026" },
]

export default function BazaarOverviewPage() {
  const [selectedEvent, setSelectedEvent] = useState(bazaarEvents[0])
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false)

  const stats = [
    {
      label: "Total Booths",
      value: selectedEvent.booths.total,
      subtext: `${selectedEvent.booths.assigned} assigned`,
      icon: Store,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      label: "Vendors",
      value: selectedEvent.vendors.total,
      subtext: `${selectedEvent.vendors.pending} pending approval`,
      icon: Users,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      label: "Food Trucks",
      value: selectedEvent.foodTrucks,
      subtext: "Registered",
      icon: Utensils,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      label: "Activities",
      value: selectedEvent.activities,
      subtext: "Scheduled",
      icon: Sparkles,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      label: "Entertainment",
      value: selectedEvent.entertainment,
      subtext: "Performers",
      icon: Music,
      color: "text-pink-600",
      bgColor: "bg-pink-50",
    },
    {
      label: "Expected Attendance",
      value: selectedEvent.expectedAttendees.toLocaleString(),
      subtext: "Attendees",
      icon: TrendingUp,
      color: "text-cyan-600",
      bgColor: "bg-cyan-50",
    },
  ]

  return (
    <>
      <Header title="Bazaar" />
      <div className="p-6">
        <div className="flex flex-col gap-6">
          {/* Event Selector & Actions */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Select
                value={selectedEvent.id}
                onValueChange={(val) => setSelectedEvent(bazaarEvents.find((e) => e.id === val) || bazaarEvents[0])}
              >
                <SelectTrigger className="w-[280px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bazaarEvents.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge
                variant="outline"
                className={cn(
                  selectedEvent.status === "upcoming" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                  selectedEvent.status === "planning" && "border-blue-200 bg-blue-50 text-blue-700",
                  selectedEvent.status === "draft" && "border-muted bg-muted text-muted-foreground"
                )}
              >
                {selectedEvent.status.charAt(0).toUpperCase() + selectedEvent.status.slice(1)}
              </Badge>
            </div>
            <Button onClick={() => setCreateDrawerOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Bazaar Event
            </Button>
            <CreateBazaarEventDrawer open={createDrawerOpen} onOpenChange={setCreateDrawerOpen} />
          </div>

          {/* Event Info Banner */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold text-foreground">{selectedEvent.name}</h2>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    {selectedEvent.date}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {selectedEvent.location}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    10:00 AM - 8:00 PM
                  </span>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Edit Event Details
              </Button>
            </CardContent>
          </Card>

          {/* Stats Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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

          {/* Two Column Layout */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Booth Allocation */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Booth Allocation</CardTitle>
                  <CardDescription>Current booth assignment status</CardDescription>
                </div>
                <Link href="/bazaar/booths">
                  <Button variant="ghost" size="sm" className="gap-1">
                    Manage
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {selectedEvent.booths.assigned} of {selectedEvent.booths.total} booths assigned
                  </span>
                  <span className="font-medium">
                    {Math.round((selectedEvent.booths.assigned / selectedEvent.booths.total) * 100)}%
                  </span>
                </div>
                <Progress value={(selectedEvent.booths.assigned / selectedEvent.booths.total) * 100} className="h-2" />
                <div className="grid grid-cols-3 gap-4 pt-2">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-emerald-600">{selectedEvent.booths.assigned}</p>
                    <p className="text-xs text-muted-foreground">Assigned</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{selectedEvent.booths.available}</p>
                    <p className="text-xs text-muted-foreground">Available</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-muted-foreground">{selectedEvent.booths.total}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Vendor Status */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Vendor Applications</CardTitle>
                  <CardDescription>Application processing status</CardDescription>
                </div>
                <Link href="/bazaar/vendors">
                  <Button variant="ghost" size="sm" className="gap-1">
                    View All
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {selectedEvent.vendors.approved} approved, {selectedEvent.vendors.pending} pending
                  </span>
                  <span className="font-medium">
                    {selectedEvent.vendors.total} total
                  </span>
                </div>
                <Progress value={(selectedEvent.vendors.approved / Math.max(selectedEvent.vendors.total, 1)) * 100} className="h-2" />
                <div className="grid grid-cols-3 gap-4 pt-2">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-emerald-600">{selectedEvent.vendors.approved}</p>
                    <p className="text-xs text-muted-foreground">Approved</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-amber-600">{selectedEvent.vendors.pending}</p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-muted-foreground">{selectedEvent.vendors.total}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Vendor Applications */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Recent Vendor Applications</CardTitle>
                <CardDescription>Latest vendor applications requiring review</CardDescription>
              </div>
              <Link href="/bazaar/vendors">
                <Button variant="outline" size="sm">
                  View All Applications
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Booth Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentApplications.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell className="font-medium">{app.vendor}</TableCell>
                      <TableCell>{app.type}</TableCell>
                      <TableCell>{app.boothType}</TableCell>
                      <TableCell className="text-muted-foreground">{app.date}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "gap-1",
                            app.status === "approved" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                            app.status === "pending" && "border-amber-200 bg-amber-50 text-amber-700",
                            app.status === "rejected" && "border-red-200 bg-red-50 text-red-700"
                          )}
                        >
                          {app.status === "approved" && <CheckCircle2 className="h-3 w-3" />}
                          {app.status === "pending" && <Loader2 className="h-3 w-3" />}
                          {app.status === "rejected" && <AlertCircle className="h-3 w-3" />}
                          {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {app.status === "pending" && (
                          <Button variant="outline" size="sm">
                            Review
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Quick Actions Row */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
              <CardDescription>Common tasks for managing your bazaar event</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Link href="/bazaar/applications">
                  <Button variant="outline" className="gap-2">
                    <FileText className="h-4 w-4" />
                    Review Applications
                  </Button>
                </Link>
                <Link href="/bazaar/booths">
                  <Button variant="outline" className="gap-2">
                    <Store className="h-4 w-4" />
                    Assign Booths
                  </Button>
                </Link>
                <Link href="/bazaar/payments">
                  <Button variant="outline" className="gap-2">
                    <DollarSign className="h-4 w-4" />
                    Record Vendor Payment
                  </Button>
                </Link>
                <Link href="/bazaar/community-calendar">
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

          {/* Workflow Summary & Deadlines */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Workflow Summary Cards */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Workflow Summary</CardTitle>
                  <CardDescription>Current status of key operational metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="flex items-center gap-3 rounded-lg border p-3">
                      <div className="rounded-lg bg-amber-50 p-2">
                        <ClipboardList className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-amber-600">{workflowData.pendingApplications}</p>
                        <p className="text-xs text-muted-foreground">Pending Applications</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border p-3">
                      <div className="rounded-lg bg-emerald-50 p-2">
                        <Users className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-emerald-600">{workflowData.approvedVendors}</p>
                        <p className="text-xs text-muted-foreground">Approved Vendors</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border p-3">
                      <div className="rounded-lg bg-red-50 p-2">
                        <CreditCard className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-red-600">{workflowData.unpaidVendorFees}</p>
                        <p className="text-xs text-muted-foreground">Unpaid Vendor Fees</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border p-3">
                      <div className="rounded-lg bg-blue-50 p-2">
                        <Store className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-blue-600">{workflowData.boothsRemaining}</p>
                        <p className="text-xs text-muted-foreground">Booths Remaining</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg border p-3 sm:col-span-2 lg:col-span-2">
                      <div className="rounded-lg bg-emerald-50 p-2">
                        <Globe className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">Community Calendar</p>
                          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Published
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">Event is visible on community calendar</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Upcoming Deadlines Panel */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Upcoming Deadlines</CardTitle>
                <CardDescription>Key dates to remember</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {upcomingDeadlines.map((deadline) => (
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
                      {deadline.type === "application" && <FileText className={cn("h-4 w-4", deadline.daysLeft <= 3 ? "text-red-600" : "text-muted-foreground")} />}
                      {deadline.type === "payment" && <DollarSign className={cn("h-4 w-4", deadline.daysLeft <= 3 ? "text-red-600" : "text-muted-foreground")} />}
                      {deadline.type === "booth" && <Store className={cn("h-4 w-4", deadline.daysLeft <= 3 ? "text-red-600" : "text-muted-foreground")} />}
                      {deadline.type === "publish" && <Globe className={cn("h-4 w-4", deadline.daysLeft <= 3 ? "text-red-600" : "text-muted-foreground")} />}
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
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Module Quick Links */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/bazaar/booths">
              <Card className="cursor-pointer transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="rounded-lg bg-blue-50 p-3">
                    <Store className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">Manage Booths</p>
                    <p className="text-sm text-muted-foreground">Configure booth types & layout</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/bazaar/activities">
              <Card className="cursor-pointer transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="rounded-lg bg-purple-50 p-3">
                    <Sparkles className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium">Activities</p>
                    <p className="text-sm text-muted-foreground">Kids zone, games & more</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/bazaar/food-trucks">
              <Card className="cursor-pointer transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="rounded-lg bg-orange-50 p-3">
                    <Utensils className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-medium">Food Trucks</p>
                    <p className="text-sm text-muted-foreground">Manage food vendors</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/bazaar/entertainment">
              <Card className="cursor-pointer transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="rounded-lg bg-pink-50 p-3">
                    <Music className="h-6 w-6 text-pink-600" />
                  </div>
                  <div>
                    <p className="font-medium">Entertainment</p>
                    <p className="text-sm text-muted-foreground">Performers & shows</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
