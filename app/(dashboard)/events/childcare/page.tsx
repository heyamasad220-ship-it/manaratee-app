"use client"

import { useState } from "react"
import { Header } from "@/components/layout/header"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Search, Plus, Baby, Users, CalendarDays, Clock, MoreHorizontal, Edit, Trash2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const childcareRegistrations = [
  {
    id: "cc-1",
    childName: "Aisha Khan",
    parentName: "Fatima Khan",
    age: 4,
    event: "Friday Prayer",
    date: "Mar 7, 2026",
    time: "12:00 PM - 2:00 PM",
    status: "Confirmed",
    allergies: "None",
    notes: "",
  },
  {
    id: "cc-2",
    childName: "Omar Hassan",
    parentName: "Ahmed Hassan",
    age: 6,
    event: "Community Iftar",
    date: "Mar 10, 2026",
    time: "5:30 PM - 8:30 PM",
    status: "Confirmed",
    allergies: "Peanuts",
    notes: "Bring EpiPen",
  },
  {
    id: "cc-3",
    childName: "Layla Ahmed",
    parentName: "Sara Ahmed",
    age: 3,
    event: "Eid Bazaar 2026",
    date: "Mar 30, 2026",
    time: "10:00 AM - 4:00 PM",
    status: "Waitlisted",
    allergies: "None",
    notes: "",
  },
  {
    id: "cc-4",
    childName: "Yusuf Ali",
    parentName: "Mohamed Ali",
    age: 5,
    event: "Friday Prayer",
    date: "Mar 7, 2026",
    time: "12:00 PM - 2:00 PM",
    status: "Confirmed",
    allergies: "Dairy",
    notes: "",
  },
  {
    id: "cc-5",
    childName: "Mariam Johnson",
    parentName: "Sarah Johnson",
    age: 7,
    event: "Spring Fundraiser Gala",
    date: "Apr 12, 2026",
    time: "6:00 PM - 10:00 PM",
    status: "Pending",
    allergies: "None",
    notes: "First time attendee",
  },
]

const upcomingEvents = [
  { id: "evt-1", name: "Friday Prayer", date: "Mar 7, 2026", registered: 12, capacity: 20 },
  { id: "evt-2", name: "Community Iftar", date: "Mar 10, 2026", registered: 18, capacity: 25 },
  { id: "evt-3", name: "Eid Bazaar 2026", date: "Mar 30, 2026", registered: 45, capacity: 50 },
  { id: "evt-4", name: "Spring Fundraiser Gala", date: "Apr 12, 2026", registered: 8, capacity: 15 },
]

export default function EventsChildcarePage() {
  const [search, setSearch] = useState("")
  const [eventFilter, setEventFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showAddDialog, setShowAddDialog] = useState(false)

  const filtered = childcareRegistrations.filter((reg) => {
    const matchesSearch =
      reg.childName.toLowerCase().includes(search.toLowerCase()) ||
      reg.parentName.toLowerCase().includes(search.toLowerCase())
    const matchesEvent = eventFilter === "all" || reg.event === eventFilter
    const matchesStatus = statusFilter === "all" || reg.status === statusFilter
    return matchesSearch && matchesEvent && matchesStatus
  })

  const totalRegistrations = childcareRegistrations.length
  const confirmedCount = childcareRegistrations.filter((r) => r.status === "Confirmed").length
  const waitlistedCount = childcareRegistrations.filter((r) => r.status === "Waitlisted").length
  const pendingCount = childcareRegistrations.filter((r) => r.status === "Pending").length

  return (
    <>
      <Header title="Childcare" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Registrations</CardTitle>
              <Baby className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalRegistrations}</div>
              <p className="text-xs text-muted-foreground">Across all events</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Confirmed</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{confirmedCount}</div>
              <p className="text-xs text-muted-foreground">Ready for childcare</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Waitlisted</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{waitlistedCount}</div>
              <p className="text-xs text-muted-foreground">Awaiting availability</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{pendingCount}</div>
              <p className="text-xs text-muted-foreground">Awaiting confirmation</p>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Events with Childcare */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Events with Childcare</CardTitle>
            <CardDescription>Events offering childcare services</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="rounded-lg border p-4">
                  <p className="font-medium">{event.name}</p>
                  <p className="text-sm text-muted-foreground">{event.date}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm">
                      {event.registered}/{event.capacity} registered
                    </span>
                    <div className="h-2 w-16 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${(event.registered / event.capacity) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Filters and Search */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by child or parent name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 sm:w-[280px]"
              />
            </div>
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by event" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                {upcomingEvents.map((event) => (
                  <SelectItem key={event.id} value={event.name}>
                    {event.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Confirmed">Confirmed</SelectItem>
                <SelectItem value="Waitlisted">Waitlisted</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Registration
          </Button>
        </div>

        {/* Registrations Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Child</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Allergies</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((reg) => (
                  <TableRow key={reg.id}>
                    <TableCell className="font-medium">{reg.childName}</TableCell>
                    <TableCell>{reg.parentName}</TableCell>
                    <TableCell>{reg.age} yrs</TableCell>
                    <TableCell>{reg.event}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{reg.date}</p>
                        <p className="text-muted-foreground">{reg.time}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          reg.status === "Confirmed"
                            ? "default"
                            : reg.status === "Waitlisted"
                            ? "secondary"
                            : "outline"
                        }
                        className={
                          reg.status === "Confirmed"
                            ? "bg-green-100 text-green-800 hover:bg-green-100"
                            : reg.status === "Waitlisted"
                            ? "bg-amber-100 text-amber-800 hover:bg-amber-100"
                            : ""
                        }
                      >
                        {reg.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {reg.allergies !== "None" ? (
                        <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100">
                          {reg.allergies}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Add Registration Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Childcare Registration</DialogTitle>
            <DialogDescription>
              Register a child for childcare at an upcoming event
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="child-name">Child Name</Label>
              <Input id="child-name" placeholder="Enter child's name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="parent-name">Parent Name</Label>
                <Input id="parent-name" placeholder="Enter parent's name" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="child-age">Age</Label>
                <Input id="child-age" type="number" placeholder="Age" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="event">Event</Label>
              <Select>
                <SelectTrigger id="event">
                  <SelectValue placeholder="Select event" />
                </SelectTrigger>
                <SelectContent>
                  {upcomingEvents.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.name} - {event.date}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="allergies">Allergies</Label>
              <Input id="allergies" placeholder="List any allergies (or None)" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" placeholder="Any special instructions" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowAddDialog(false)}>
              Add Registration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
