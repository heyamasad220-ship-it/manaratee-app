"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { Search, ChevronUp, ChevronDown, Plus, Calendar, Clock, CheckCircle2, XCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type VolunteerStatus = "Active" | "Inactive" | "Pending"

interface VolunteerSignUp {
  id: string
  eventName: string
  date: string
  role: string
  hoursLogged: number
  status: "Confirmed" | "Pending" | "Completed" | "Cancelled"
}

interface VolunteerHistory {
  id: string
  eventName: string
  date: string
  role: string
  hoursWorked: number
  performance: "Excellent" | "Good" | "Average" | "Poor"
  notes?: string
}

interface Volunteer {
  id: string
  name: string
  email: string
  phone: string
  status: VolunteerStatus
  joinDate: string
  totalHours: number
  eventsVolunteered: number
  skills: string[]
  availability: string[]
  signUps: VolunteerSignUp[]
  history: VolunteerHistory[]
}

const mockVolunteers: Volunteer[] = [
  {
    id: "vol-001",
    name: "Sarah Johnson",
    email: "sarah.johnson@email.com",
    phone: "(555) 123-4567",
    status: "Active",
    joinDate: "Jan 15, 2025",
    totalHours: 120,
    eventsVolunteered: 15,
    skills: ["Event Setup", "Registration", "Photography"],
    availability: ["Weekends", "Evenings"],
    signUps: [
      { id: "su-1", eventName: "Spring Festival", date: "Apr 15, 2026", role: "Event Setup", hoursLogged: 6, status: "Confirmed" },
      { id: "su-2", eventName: "Community Cleanup", date: "Mar 20, 2026", role: "Team Lead", hoursLogged: 4, status: "Confirmed" },
    ],
    history: [
      { id: "h-1", eventName: "Eid Bazaar 2025", date: "Apr 10, 2025", role: "Registration", hoursWorked: 8, performance: "Excellent", notes: "Handled high volume of attendees efficiently. Very organized." },
      { id: "h-2", eventName: "Community Iftar 2025", date: "Mar 25, 2025", role: "Event Setup", hoursWorked: 6, performance: "Excellent", notes: "Arrived early, helped coordinate other volunteers." },
      { id: "h-3", eventName: "Winter Fundraiser 2024", date: "Dec 15, 2024", role: "Photography", hoursWorked: 5, performance: "Good", notes: "Great photos captured." },
    ],
  },
  {
    id: "vol-002",
    name: "Michael Chen",
    email: "michael.chen@email.com",
    phone: "(555) 234-5678",
    status: "Active",
    joinDate: "Mar 10, 2025",
    totalHours: 85,
    eventsVolunteered: 10,
    skills: ["Teaching", "Youth Programs", "Sports"],
    availability: ["Weekdays", "Mornings"],
    signUps: [
      { id: "su-3", eventName: "Youth Soccer Camp", date: "May 1, 2026", role: "Coach", hoursLogged: 0, status: "Pending" },
    ],
    history: [
      { id: "h-4", eventName: "Summer Youth Camp 2025", date: "Jul 15, 2025", role: "Sports Coach", hoursWorked: 20, performance: "Excellent", notes: "Kids loved him. Great energy and patience." },
      { id: "h-5", eventName: "Basketball Tournament 2025", date: "Jun 10, 2025", role: "Referee", hoursWorked: 6, performance: "Good", notes: "" },
    ],
  },
  {
    id: "vol-003",
    name: "Amira Hassan",
    email: "amira.hassan@email.com",
    phone: "(555) 345-6789",
    status: "Active",
    joinDate: "Jun 5, 2024",
    totalHours: 200,
    eventsVolunteered: 25,
    skills: ["Food Service", "Kitchen", "Event Planning"],
    availability: ["Weekends", "Flexible"],
    signUps: [
      { id: "su-4", eventName: "Ramadan Iftar", date: "Mar 15, 2026", role: "Kitchen Lead", hoursLogged: 8, status: "Confirmed" },
      { id: "su-5", eventName: "Food Drive", date: "Apr 1, 2026", role: "Coordinator", hoursLogged: 0, status: "Pending" },
    ],
    history: [
      { id: "h-6", eventName: "Eid Banquet 2025", date: "Apr 12, 2025", role: "Kitchen Lead", hoursWorked: 10, performance: "Excellent", notes: "Coordinated 15 volunteers. Food was excellent." },
      { id: "h-7", eventName: "Monthly Potluck Feb 2025", date: "Feb 20, 2025", role: "Food Service", hoursWorked: 4, performance: "Excellent", notes: "" },
      { id: "h-8", eventName: "Community Dinner 2024", date: "Nov 15, 2024", role: "Setup & Cleanup", hoursWorked: 6, performance: "Good", notes: "Very thorough with cleanup." },
    ],
  },
  {
    id: "vol-004",
    name: "David Williams",
    email: "david.williams@email.com",
    phone: "(555) 456-7890",
    status: "Inactive",
    joinDate: "Sep 20, 2024",
    totalHours: 45,
    eventsVolunteered: 6,
    skills: ["IT Support", "Audio/Visual", "Setup"],
    availability: ["Evenings"],
    signUps: [],
    history: [
      { id: "h-9", eventName: "Tech Workshop 2024", date: "Oct 5, 2024", role: "IT Support", hoursWorked: 4, performance: "Good", notes: "Helped with AV setup." },
    ],
  },
  {
    id: "vol-005",
    name: "Fatima Al-Rashid",
    email: "fatima.rashid@email.com",
    phone: "(555) 567-8901",
    status: "Active",
    joinDate: "Nov 1, 2024",
    totalHours: 65,
    eventsVolunteered: 8,
    skills: ["Childcare", "Teaching", "First Aid"],
    availability: ["Weekends", "Mornings"],
    signUps: [
      { id: "su-6", eventName: "Sunday School", date: "Mar 10, 2026", role: "Teacher Aide", hoursLogged: 3, status: "Confirmed" },
    ],
    history: [
      { id: "h-10", eventName: "Sunday School 2025", date: "Sep-Dec 2025", role: "Teacher Aide", hoursWorked: 40, performance: "Excellent", notes: "Wonderful with kids. Parents gave positive feedback." },
      { id: "h-11", eventName: "Summer Camp 2025", date: "Jul 2025", role: "Childcare", hoursWorked: 25, performance: "Excellent", notes: "CPR certified. Very reliable." },
    ],
  },
  {
    id: "vol-006",
    name: "James Thompson",
    email: "james.thompson@email.com",
    phone: "(555) 678-9012",
    status: "Pending",
    joinDate: "Feb 15, 2026",
    totalHours: 0,
    eventsVolunteered: 0,
    skills: ["Construction", "Maintenance"],
    availability: ["Weekends"],
    signUps: [],
    history: [],
  },
  {
    id: "vol-007",
    name: "Nadia Omar",
    email: "nadia.omar@email.com",
    phone: "(555) 789-0123",
    status: "Active",
    joinDate: "Apr 10, 2024",
    totalHours: 150,
    eventsVolunteered: 20,
    skills: ["Translation", "Community Outreach", "Administration"],
    availability: ["Flexible"],
    signUps: [
      { id: "su-7", eventName: "New Member Orientation", date: "Mar 25, 2026", role: "Translator", hoursLogged: 2, status: "Confirmed" },
    ],
    history: [
      { id: "h-12", eventName: "Community Outreach 2025", date: "Oct 20, 2025", role: "Translator", hoursWorked: 6, performance: "Excellent", notes: "Helped translate for 20+ families." },
      { id: "h-13", eventName: "New Member Welcome 2025", date: "Aug 15, 2025", role: "Coordinator", hoursWorked: 4, performance: "Excellent", notes: "" },
      { id: "h-14", eventName: "Admin Support 2025", date: "Jan-Jun 2025", role: "Office Help", hoursWorked: 50, performance: "Excellent", notes: "Invaluable administrative support." },
    ],
  },
  {
    id: "vol-008",
    name: "Robert Garcia",
    email: "robert.garcia@email.com",
    phone: "(555) 890-1234",
    status: "Inactive",
    joinDate: "Jul 1, 2023",
    totalHours: 30,
    eventsVolunteered: 4,
    skills: ["Security", "Parking"],
    availability: ["Evenings", "Weekends"],
    signUps: [],
    history: [
      { id: "h-15", eventName: "Eid Prayer 2024", date: "Apr 10, 2024", role: "Parking", hoursWorked: 4, performance: "Good", notes: "Managed parking lot efficiently." },
    ],
  },
]

type SortField = "name" | "status" | "joinDate" | "totalHours" | "eventsVolunteered"
type SortDirection = "asc" | "desc"

function SortIcon({
  field,
  currentField,
  direction,
}: {
  field: SortField
  currentField: SortField
  direction: SortDirection
}) {
  if (field !== currentField) {
    return <ChevronUp className="ml-1 inline size-3.5 text-muted-foreground/40" />
  }
  return direction === "asc" ? (
    <ChevronUp className="ml-1 inline size-3.5" />
  ) : (
    <ChevronDown className="ml-1 inline size-3.5" />
  )
}

const statusStyles: Record<VolunteerStatus, string> = {
  Active: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Inactive: "bg-gray-100 text-gray-700 hover:bg-gray-100",
  Pending: "bg-amber-100 text-amber-700 hover:bg-amber-100",
}

const signUpStatusStyles: Record<string, string> = {
  Confirmed: "bg-emerald-100 text-emerald-700",
  Pending: "bg-amber-100 text-amber-700",
  Completed: "bg-blue-100 text-blue-700",
  Cancelled: "bg-red-100 text-red-700",
}

const performanceStyles: Record<string, string> = {
  Excellent: "bg-emerald-100 text-emerald-700",
  Good: "bg-blue-100 text-blue-700",
  Average: "bg-amber-100 text-amber-700",
  Poor: "bg-red-100 text-red-700",
}

export function VolunteersList() {
  const [mounted, setMounted] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [skillFilter, setSkillFilter] = useState<string>("all")
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [selectedVolunteer, setSelectedVolunteer] = useState<Volunteer | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Get unique skills for filter
  const allSkills = useMemo(() => {
    const skills = new Set<string>()
    mockVolunteers.forEach((v) => v.skills.forEach((s) => skills.add(s)))
    return Array.from(skills).sort()
  }, [])

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const filtered = useMemo(() => {
    let result = [...mockVolunteers]

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.email.toLowerCase().includes(q)
      )
    }

    if (statusFilter !== "all") {
      result = result.filter((v) => v.status === statusFilter)
    }

    if (skillFilter !== "all") {
      result = result.filter((v) => v.skills.includes(skillFilter))
    }

    result.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case "name":
          cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase())
          break
        case "status":
          cmp = a.status.localeCompare(b.status)
          break
        case "joinDate":
          cmp = new Date(a.joinDate).getTime() - new Date(b.joinDate).getTime()
          break
        case "totalHours":
          cmp = a.totalHours - b.totalHours
          break
        case "eventsVolunteered":
          cmp = a.eventsVolunteered - b.eventsVolunteered
          break
      }
      return sortDirection === "asc" ? cmp : -cmp
    })

    return result
  }, [search, statusFilter, skillFilter, sortField, sortDirection])

  const totalHours = filtered.reduce((sum, v) => sum + v.totalHours, 0)
  const activeCount = mockVolunteers.filter((v) => v.status === "Active").length
  const pendingSignUps = mockVolunteers.reduce(
    (sum, v) => sum + v.signUps.filter((s) => s.status === "Pending" || s.status === "Confirmed").length,
    0
  )

  if (!mounted) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="h-10 w-48 animate-pulse rounded bg-muted" />
        <div className="h-9 w-full max-w-sm animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border border-border">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <CheckCircle2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{mockVolunteers.length}</p>
              <p className="text-xs text-muted-foreground">Total Volunteers</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Active Volunteers</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
              <Clock className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalHours.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total Hours</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
              <Calendar className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{pendingSignUps}</p>
              <p className="text-xs text-muted-foreground">Upcoming Sign-Ups</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Volunteers</h2>
          <p className="text-sm text-muted-foreground">
            {filtered.length} of {mockVolunteers.length}{" "}
            {mockVolunteers.length !== 1 ? "volunteers" : "volunteer"}
          </p>
        </div>
        <Button size="sm">
          <Plus className="mr-1.5 size-4" />
          Add Volunteer
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
          </SelectContent>
        </Select>
        <Select value={skillFilter} onValueChange={setSkillFilter}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="All Skills" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Skills</SelectItem>
            {allSkills.map((skill) => (
              <SelectItem key={skill} value={skill}>
                {skill}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                    onClick={() => handleSort("name")}
                  >
                    Name
                    <SortIcon field="name" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                    onClick={() => handleSort("status")}
                  >
                    Status
                    <SortIcon field="status" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead>Skills</TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                    onClick={() => handleSort("joinDate")}
                  >
                    Join Date
                    <SortIcon field="joinDate" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    type="button"
                    className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                    onClick={() => handleSort("totalHours")}
                  >
                    Hours
                    <SortIcon field="totalHours" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    type="button"
                    className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                    onClick={() => handleSort("eventsVolunteered")}
                  >
                    Events
                    <SortIcon field="eventsVolunteered" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead>Sign-Ups</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No volunteers found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((volunteer) => (
                  <TableRow key={volunteer.id}>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => setSelectedVolunteer(volunteer)}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {volunteer.name}
                      </button>
                      <p className="text-xs text-muted-foreground">{volunteer.email}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusStyles[volunteer.status]}>
                        {volunteer.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {volunteer.skills.slice(0, 2).map((skill) => (
                          <Badge key={skill} variant="outline" className="text-xs font-normal">
                            {skill}
                          </Badge>
                        ))}
                        {volunteer.skills.length > 2 && (
                          <Badge variant="outline" className="text-xs font-normal">
                            +{volunteer.skills.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{volunteer.joinDate}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {volunteer.totalHours}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {volunteer.eventsVolunteered}
                    </TableCell>
                    <TableCell>
                      {volunteer.signUps.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {volunteer.signUps.slice(0, 2).map((signup) => (
                            <Badge
                              key={signup.id}
                              variant="secondary"
                              className={`text-xs ${signUpStatusStyles[signup.status]}`}
                            >
                              {signup.eventName}
                            </Badge>
                          ))}
                          {volunteer.signUps.length > 2 && (
                            <span className="text-xs text-muted-foreground">
                              +{volunteer.signUps.length - 2} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Volunteer Detail Dialog */}
      <Dialog open={!!selectedVolunteer} onOpenChange={() => setSelectedVolunteer(null)}>
        <DialogContent className="max-w-2xl">
          {selectedVolunteer && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  {selectedVolunteer.name}
                  <Badge variant="secondary" className={statusStyles[selectedVolunteer.status]}>
                    {selectedVolunteer.status}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  Volunteer since {selectedVolunteer.joinDate}
                </DialogDescription>
              </DialogHeader>
              <Tabs defaultValue="info" className="mt-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="info">Info</TabsTrigger>
                  <TabsTrigger value="history">History ({selectedVolunteer.history.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="mt-4">
                  <div className="flex flex-col gap-6">
                    {/* Contact Info */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Email</span>
                        <span className="text-sm font-medium">{selectedVolunteer.email}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Phone</span>
                        <span className="text-sm font-medium">{selectedVolunteer.phone}</span>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-lg border border-border p-4 text-center">
                        <p className="text-2xl font-bold text-foreground">{selectedVolunteer.totalHours}</p>
                        <p className="text-xs text-muted-foreground">Total Hours</p>
                      </div>
                      <div className="rounded-lg border border-border p-4 text-center">
                        <p className="text-2xl font-bold text-foreground">{selectedVolunteer.eventsVolunteered}</p>
                        <p className="text-xs text-muted-foreground">Events</p>
                      </div>
                      <div className="rounded-lg border border-border p-4 text-center">
                        <p className="text-2xl font-bold text-foreground">{selectedVolunteer.signUps.length}</p>
                        <p className="text-xs text-muted-foreground">Active Sign-Ups</p>
                      </div>
                    </div>

                    {/* Skills */}
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-medium">Skills</span>
                      <div className="flex flex-wrap gap-2">
                        {selectedVolunteer.skills.map((skill) => (
                          <Badge key={skill} variant="secondary">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Availability */}
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-medium">Availability</span>
                      <div className="flex flex-wrap gap-2">
                        {selectedVolunteer.availability.map((avail) => (
                          <Badge key={avail} variant="outline">
                            {avail}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Sign-Ups */}
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-medium">Upcoming Sign-Ups</span>
                      {selectedVolunteer.signUps.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No active sign-ups</p>
                      ) : (
                        <div className="rounded-lg border border-border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Event</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Hours</TableHead>
                                <TableHead>Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedVolunteer.signUps.map((signup) => (
                                <TableRow key={signup.id}>
                                  <TableCell className="font-medium">{signup.eventName}</TableCell>
                                  <TableCell className="text-muted-foreground">{signup.date}</TableCell>
                                  <TableCell>{signup.role}</TableCell>
                                  <TableCell className="tabular-nums">{signup.hoursLogged}</TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="secondary"
                                      className={signUpStatusStyles[signup.status]}
                                    >
                                      {signup.status}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="history" className="mt-4">
                  <div className="flex flex-col gap-4">
                    {/* Summary Stats */}
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-lg border border-border p-3 text-center">
                        <p className="text-xl font-bold text-foreground">{selectedVolunteer.history.length}</p>
                        <p className="text-xs text-muted-foreground">Events Completed</p>
                      </div>
                      <div className="rounded-lg border border-border p-3 text-center">
                        <p className="text-xl font-bold text-foreground">
                          {selectedVolunteer.history.reduce((sum, h) => sum + h.hoursWorked, 0)}
                        </p>
                        <p className="text-xs text-muted-foreground">Total Hours</p>
                      </div>
                      <div className="rounded-lg border border-border p-3 text-center">
                        <p className="text-xl font-bold text-primary">
                          {selectedVolunteer.history.length > 0 
                            ? Math.round((selectedVolunteer.history.filter(h => h.performance === "Excellent" || h.performance === "Good").length / selectedVolunteer.history.length) * 100)
                            : 0}%
                        </p>
                        <p className="text-xs text-muted-foreground">Positive Reviews</p>
                      </div>
                    </div>

                    {/* History List */}
                    {selectedVolunteer.history.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">No participation history yet.</p>
                    ) : (
                      <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto">
                        {selectedVolunteer.history.map((record) => (
                          <div key={record.id} className="rounded-lg border p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{record.eventName}</span>
                                  <Badge variant="secondary" className={performanceStyles[record.performance]}>
                                    {record.performance}
                                  </Badge>
                                </div>
                                <span className="text-xs text-muted-foreground">{record.date}</span>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium">{record.hoursWorked} hrs</p>
                                <p className="text-xs text-muted-foreground">{record.role}</p>
                              </div>
                            </div>
                            {record.notes && (
                              <div className="mt-2 rounded bg-muted/50 p-2">
                                <p className="text-xs text-muted-foreground">{record.notes}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedVolunteer(null)}>
                  Close
                </Button>
                <Button>Edit Volunteer</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
