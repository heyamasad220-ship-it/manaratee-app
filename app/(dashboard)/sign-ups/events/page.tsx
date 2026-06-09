"use client"

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { Search, ChevronLeft, ChevronRight, Edit, MoreHorizontal, Plus, CalendarDays, MapPin } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { TimeInput } from "@/components/ui/time-input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { signUps } from "@/lib/mock-data"
import { StatusBadge } from "@/lib/status-badges"
import { cn } from "@/lib/utils"

const eventsTabs = ["Upcoming", "Previous"] as const
type EventsTab = typeof eventsTabs[number]

const upcomingSignUps = signUps.filter(
  (s) => s.status === "Published" && new Date(s.startDate) >= new Date("2024-04-12")
)

const pastSignUps = signUps.filter(
  (s) => new Date(s.startDate) < new Date("2024-04-12")
)

export default function SignUpsEventsPage() {
  const [activeTab, setActiveTab] = useState<EventsTab>("Upcoming")
  const [search, setSearch] = useState("")
  const [showNewEventDialog, setShowNewEventDialog] = useState(false)
  const [volunteerSignUps, setVolunteerSignUps] = useState(false)
  const [childcareEnabled, setChildcareEnabled] = useState(false)

  const currentData = activeTab === "Upcoming" ? upcomingSignUps : pastSignUps

  const filtered = currentData.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.groupName.toLowerCase().includes(search.toLowerCase()) ||
      s.schedule.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <Header title="Sign-Ups" />

      <div className="flex flex-col gap-6 p-6">
        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border">
          {eventsTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "relative px-4 py-2 text-sm font-medium transition-colors",
                activeTab === tab
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          ))}
        </div>

        {/* Header and Search */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              {activeTab === "Upcoming" ? "Upcoming Sign-Ups" : "Past Sign-Ups"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {filtered.length} sign-up{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={`Search ${activeTab.toLowerCase()} sign-ups...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {activeTab === "Upcoming" && (
              <Button className="ml-auto gap-1.5" onClick={() => setShowNewEventDialog(true)}>
                <Plus className="h-4 w-4" />
                New Event
              </Button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[140px]">Date</TableHead>
                <TableHead>Sign-up Title</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Group Name</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No {activeTab.toLowerCase()} sign-ups found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((signUp) => (
                  <TableRow key={signUp.id}>
                    <TableCell className="text-muted-foreground">{signUp.startDate}</TableCell>
                    <TableCell>
                      <span className="font-medium text-primary underline-offset-4 hover:underline cursor-pointer">
                        {signUp.title}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{signUp.schedule}</TableCell>
                    <TableCell className="text-muted-foreground">{signUp.groupName}</TableCell>
                    <TableCell>
                      <StatusBadge status={signUp.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon-sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-end gap-3 text-sm text-muted-foreground">
          <span>{filtered.length} Sign-ups</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" disabled>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon-sm">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* New Event Dialog */}
      <Dialog open={showNewEventDialog} onOpenChange={setShowNewEventDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Internal Event</DialogTitle>
            <DialogDescription>
              Add a new internal event for your organization
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-5 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="event-title">Event Title</Label>
              <Input id="event-title" placeholder="Enter event title" />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="event-description">Description</Label>
              <Textarea
                id="event-description"
                placeholder="Describe the event..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="event-date">Date</Label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="event-date" type="date" className="pl-9" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="event-time">Time</Label>
                <TimeInput id="event-time" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="event-location">Location</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="event-location" placeholder="Enter location" className="pl-9" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="event-department">Department</Label>
              <Select>
                <SelectTrigger id="event-department">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="administration">Administration</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                  <SelectItem value="operations">Operations</SelectItem>
                  <SelectItem value="technology">Technology</SelectItem>
                  <SelectItem value="events">Events</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="community-outreach">Community Outreach</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Toggle Options */}
            <div className="flex flex-col gap-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor="volunteer-signups" className="text-sm font-medium">
                    Volunteer Sign-ups
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Allow volunteers to sign up for this event
                  </p>
                </div>
                <Switch
                  id="volunteer-signups"
                  checked={volunteerSignUps}
                  onCheckedChange={setVolunteerSignUps}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor="childcare" className="text-sm font-medium">
                    Childcare
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Offer childcare services for this event
                  </p>
                </div>
                <Switch
                  id="childcare"
                  checked={childcareEnabled}
                  onCheckedChange={setChildcareEnabled}
                />
              </div>
            </div>

            {/* Conditional fields for Volunteer Sign-ups */}
            {volunteerSignUps && (
              <div className="flex flex-col gap-4 rounded-lg border border-dashed p-4">
                <p className="text-sm font-medium">Volunteer Settings</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="volunteer-slots">Number of Slots</Label>
                    <Input id="volunteer-slots" type="number" placeholder="10" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="volunteer-deadline">Sign-up Deadline</Label>
                    <Input id="volunteer-deadline" type="date" />
                  </div>
                </div>
              </div>
            )}

            {/* Conditional fields for Childcare */}
            {childcareEnabled && (
              <div className="flex flex-col gap-4 rounded-lg border border-dashed p-4">
                <p className="text-sm font-medium">Childcare Settings</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="childcare-capacity">Capacity</Label>
                    <Input id="childcare-capacity" type="number" placeholder="20" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="childcare-age">Age Range</Label>
                    <Select>
                      <SelectTrigger id="childcare-age">
                        <SelectValue placeholder="Select age range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0-2">0-2 years</SelectItem>
                        <SelectItem value="3-5">3-5 years</SelectItem>
                        <SelectItem value="6-10">6-10 years</SelectItem>
                        <SelectItem value="0-10">All ages (0-10)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewEventDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowNewEventDialog(false)}>
              Create Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
