"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
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
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  MapPin,
  Clock,
  Building2,
  Globe,
  List,
  LayoutGrid,
  Eye,
} from "lucide-react"
import { cn } from "@/lib/utils"

type CommunityEvent = {
  id: string
  title: string
  organizer: string
  date: string
  time: string
  location: string
  type: string
  status: "published" | "draft"
  description: string
}

const communityEvents: CommunityEvent[] = []

const eventTypes = [
  { value: "vendor-hub", label: "Vendor Hub", color: "bg-blue-100 text-blue-700" },
  { value: "festival", label: "Festival", color: "bg-purple-100 text-purple-700" },
  { value: "carnival", label: "Carnival", color: "bg-pink-100 text-pink-700" },
  { value: "fundraiser", label: "Fundraiser", color: "bg-emerald-100 text-emerald-700" },
]

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export default function CommunityCalendarPage() {
  const [viewMode, setViewMode] = useState<"month" | "week" | "list">("month")
  const [currentDate, setCurrentDate] = useState(new Date())
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [organizerFilter, setOrganizerFilter] = useState<string>("all")
  const [showPublishDialog, setShowPublishDialog] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CommunityEvent | null>(null)

  const [publishForm, setPublishForm] = useState({
    title: "",
    organizer: "",
    date: "",
    time: "",
    location: "",
    type: "vendor-hub",
    description: "",
    isPublished: true,
  })

  const organizations = [...new Set(communityEvents.map((event) => event.organizer))]

  const filteredEvents = communityEvents.filter((event) => {
    const matchesType = typeFilter === "all" || event.type === typeFilter
    const matchesOrganizer = organizerFilter === "all" || event.organizer === organizerFilter
    return matchesType && matchesOrganizer
  })

  const getCalendarDays = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const days: (number | null)[] = []

    for (let i = 0; i < firstDay; i++) {
      days.push(null)
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i)
    }

    return days
  }

  const getEventsForDay = (day: number | null) => {
    if (!day) return []

    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(day).padStart(2, "0")}`

    return filteredEvents.filter((event) => event.date === dateStr)
  }

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const handleViewEvent = (event: CommunityEvent) => {
    setSelectedEvent(event)
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Header Controls */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border p-1">
              <Button
                variant={viewMode === "month" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("month")}
                className="gap-1"
              >
                <LayoutGrid className="h-4 w-4" />
                Month
              </Button>

              <Button
                variant={viewMode === "week" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("week")}
                className="gap-1"
              >
                <CalendarDays className="h-4 w-4" />
                Week
              </Button>

              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="gap-1"
              >
                <List className="h-4 w-4" />
                List
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Event Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {eventTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={organizerFilter} onValueChange={setOrganizerFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Organization" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Organizations</SelectItem>
                {organizations.map((org) => (
                  <SelectItem key={org} value={org}>
                    {org}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={() => setShowPublishDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Publish Vendor Hub Event
            </Button>
          </div>
        </div>

        {/* Calendar Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <Button variant="outline" size="icon" onClick={() => navigateMonth(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>

            <h2 className="text-xl font-semibold">
              {months[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
          </div>

          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>

        {/* Event Type Legend */}
        <div className="flex flex-wrap items-center gap-4">
          {eventTypes.map((type) => (
            <div key={type.value} className="flex items-center gap-2">
              <div className={cn("h-3 w-3 rounded-full", type.color.split(" ")[0])} />
              <span className="text-sm text-muted-foreground">{type.label}</span>
            </div>
          ))}
        </div>

        {/* Calendar Grid - Month View */}
        {viewMode === "month" && (
          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-7">
                {daysOfWeek.map((day) => (
                  <div
                    key={day}
                    className="border-b p-2 text-center text-sm font-medium text-muted-foreground"
                  >
                    {day}
                  </div>
                ))}

                {getCalendarDays().map((day, index) => {
                  const events = getEventsForDay(day)

                  return (
                    <div
                      key={index}
                      className={cn("min-h-[100px] border-b border-r p-1", !day && "bg-muted/30")}
                    >
                      {day && (
                        <>
                          <span className="text-sm text-muted-foreground">{day}</span>

                          <div className="mt-1 flex flex-col gap-1">
                            {events.slice(0, 2).map((event) => {
                              const typeConfig = eventTypes.find((type) => type.value === event.type)

                              return (
                                <button
                                  key={event.id}
                                  onClick={() => handleViewEvent(event)}
                                  className={cn(
                                    "w-full truncate rounded px-1 py-0.5 text-left text-xs",
                                    typeConfig?.color
                                  )}
                                >
                                  {event.title}
                                </button>
                              )
                            })}

                            {events.length > 2 && (
                              <span className="text-xs text-muted-foreground">
                                +{events.length - 2} more
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>

              {filteredEvents.length === 0 && (
                <div className="border-t p-6 text-center text-sm text-muted-foreground">
                  No community calendar events found.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* List View */}
        {viewMode === "list" && (
          <div className="flex flex-col gap-4">
            {filteredEvents.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  No community calendar events found.
                </CardContent>
              </Card>
            ) : (
              filteredEvents.map((event) => {
                const typeConfig = eventTypes.find((type) => type.value === event.type)

                return (
                  <Card
                    key={event.id}
                    className="cursor-pointer transition-colors hover:bg-muted/30"
                    onClick={() => handleViewEvent(event)}
                  >
                    <CardContent className="flex items-start gap-4 p-4">
                      <div className="flex h-14 w-14 flex-col items-center justify-center rounded-lg bg-primary/10">
                        <span className="text-xs text-muted-foreground">
                          {new Date(event.date).toLocaleDateString("en-US", { month: "short" })}
                        </span>
                        <span className="text-lg font-bold">{new Date(event.date).getDate()}</span>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold">{event.title}</h3>

                            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Building2 className="h-4 w-4" />
                                {event.organizer}
                              </span>

                              <span className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                {event.location}
                              </span>

                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {event.time}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={cn(typeConfig?.color)}>
                              {typeConfig?.label}
                            </Badge>

                            {event.status === "draft" && (
                              <Badge variant="outline" className="border-muted">
                                Draft
                              </Badge>
                            )}
                          </div>
                        </div>

                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                          {event.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        )}

        {/* Week View */}
        {viewMode === "week" && (
          <Card>
            <CardContent className="p-4">
              <p className="text-center text-muted-foreground">Week view coming soon...</p>

              <div className="mt-4 flex flex-col gap-2">
                {filteredEvents.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    No events scheduled for this week.
                  </div>
                ) : (
                  filteredEvents
                    .filter((event) => {
                      const eventDate = new Date(event.date)
                      const weekStart = new Date(currentDate)
                      weekStart.setDate(currentDate.getDate() - currentDate.getDay())

                      const weekEnd = new Date(weekStart)
                      weekEnd.setDate(weekStart.getDate() + 6)

                      return eventDate >= weekStart && eventDate <= weekEnd
                    })
                    .map((event) => {
                      const typeConfig = eventTypes.find((type) => type.value === event.type)

                      return (
                        <div
                          key={event.id}
                          onClick={() => handleViewEvent(event)}
                          className={cn(
                            "cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/30",
                            typeConfig?.color
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{event.title}</span>
                            <span className="text-sm">
                              {new Date(event.date).toLocaleDateString()}
                            </span>
                          </div>

                          <p className="text-sm">{event.organizer}</p>
                        </div>
                      )
                    })
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Event Detail Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedEvent?.title}</DialogTitle>
            <DialogDescription>Event Details</DialogDescription>
          </DialogHeader>

          {selectedEvent && (
            <div className="flex flex-col gap-4 py-4">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(eventTypes.find((type) => type.value === selectedEvent.type)?.color)}
                >
                  {eventTypes.find((type) => type.value === selectedEvent.type)?.label}
                </Badge>

                {selectedEvent.status === "published" ? (
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                    <Globe className="mr-1 h-3 w-3" />
                    Published
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-muted">
                    Draft
                  </Badge>
                )}
              </div>

              <div className="flex flex-col gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedEvent.organizer}</span>
                </div>

                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {new Date(selectedEvent.date).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedEvent.time}</span>
                </div>

                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedEvent.location}</span>
                </div>
              </div>

              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm">{selectedEvent.description}</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedEvent(null)}>
              Close
            </Button>

            {selectedEvent && (
              <Button className="gap-2">
                <Eye className="h-4 w-4" />
                Edit Event
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish Event Dialog */}
      <Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Publish to Community Calendar</DialogTitle>
            <DialogDescription>
              Share your Vendor Hub event with the community calendar so other organizations can coordinate.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="event-title">Event Title</Label>
              <Input
                id="event-title"
                placeholder="e.g., Annual Community Vendor Event"
                value={publishForm.title}
                onChange={(event) => setPublishForm({ ...publishForm, title: event.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="organizer">Organizer Name</Label>
              <Input
                id="organizer"
                value={publishForm.organizer}
                onChange={(event) => setPublishForm({ ...publishForm, organizer: event.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={publishForm.date}
                  onChange={(event) => setPublishForm({ ...publishForm, date: event.target.value })}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="time">Time</Label>
                <Input
                  id="time"
                  placeholder="e.g., 10:00 AM - 8:00 PM"
                  value={publishForm.time}
                  onChange={(event) => setPublishForm({ ...publishForm, time: event.target.value })}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="location">Public Location</Label>
              <Input
                id="location"
                placeholder="e.g., Main Hall & Outdoor Area"
                value={publishForm.location}
                onChange={(event) => setPublishForm({ ...publishForm, location: event.target.value })}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Event Category</Label>
              <Select
                value={publishForm.type}
                onValueChange={(value) => setPublishForm({ ...publishForm, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {eventTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Short Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of your event..."
                value={publishForm.description}
                onChange={(event) => setPublishForm({ ...publishForm, description: event.target.value })}
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">Publish Immediately</p>
                <p className="text-sm text-muted-foreground">
                  Make this event visible on the community calendar
                </p>
              </div>

              <Switch
                checked={publishForm.isPublished}
                onCheckedChange={(checked) => setPublishForm({ ...publishForm, isPublished: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPublishDialog(false)}>
              Cancel
            </Button>

            <Button className="gap-2">
              <Globe className="h-4 w-4" />
              {publishForm.isPublished ? "Publish Event" : "Save as Draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}