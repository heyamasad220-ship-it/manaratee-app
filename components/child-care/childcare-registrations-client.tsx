"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
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
import {
  Search,
  Plus,
  Baby,
  Users,
  CalendarDays,
  Clock,
  MoreHorizontal,
  Trash2,
  Loader2,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  createChildcareEvent,
  createChildcareRegistration,
  deleteChildcareRegistration,
  updateChildcareRegistrationStatus,
  assignChildcareEventProvider,
} from "@/lib/child-care/childcare-registration-actions"
import {
  formatChildcareDate,
  formatChildcareTimeRange,
} from "@/lib/child-care/childcare-registration-format"
import {
  CHILDCARE_REGISTRATION_STATUS_LABELS,
  type ChildcareEventSummary,
  type ChildcareRegistration,
  type ChildcareRegistrationStats,
  type ChildcareRegistrationStatus,
} from "@/lib/child-care/childcare-registration-types"
import type { ChildcareProviderPickerOption } from "@/lib/workforce/childcare-provider-queries"

function statusBadgeClass(status: ChildcareRegistrationStatus) {
  if (status === "confirmed") {
    return "bg-green-100 text-green-800 hover:bg-green-100"
  }
  if (status === "waitlisted") {
    return "bg-amber-100 text-amber-800 hover:bg-amber-100"
  }
  return ""
}

export function ChildcareRegistrationsClient({
  initialEvents,
  initialRegistrations,
  initialStats,
  providers,
}: {
  initialEvents: ChildcareEventSummary[]
  initialRegistrations: ChildcareRegistration[]
  initialStats: ChildcareRegistrationStats
  providers: ChildcareProviderPickerOption[]
}) {
  const router = useRouter()
  const [events, setEvents] = React.useState(initialEvents)
  const [registrations, setRegistrations] = React.useState(initialRegistrations)
  const [stats, setStats] = React.useState(initialStats)

  const [search, setSearch] = React.useState("")
  const [eventFilter, setEventFilter] = React.useState("all")
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [showAddDialog, setShowAddDialog] = React.useState(false)
  const [showAddEventDialog, setShowAddEventDialog] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [registrationForm, setRegistrationForm] = React.useState({
    childcare_event_id: "",
    child_name: "",
    parent_name: "",
    child_age: "",
    allergies: "",
    notes: "",
    status: "pending" as ChildcareRegistrationStatus,
  })

  const [eventForm, setEventForm] = React.useState({
    name: "",
    event_date: "",
    start_time: "",
    end_time: "",
    capacity: "20",
  })

  React.useEffect(() => {
    setEvents(initialEvents)
    setRegistrations(initialRegistrations)
    setStats(initialStats)
  }, [initialEvents, initialRegistrations, initialStats])

  const filtered = registrations.filter((reg) => {
    const matchesSearch =
      reg.child_name.toLowerCase().includes(search.toLowerCase()) ||
      (reg.parent_name || "").toLowerCase().includes(search.toLowerCase())
    const matchesEvent =
      eventFilter === "all" || reg.childcare_event_id === eventFilter
    const matchesStatus = statusFilter === "all" || reg.status === statusFilter
    return matchesSearch && matchesEvent && matchesStatus
  })

  function applyBundle(bundle: Awaited<ReturnType<typeof createChildcareRegistration>>) {
    setEvents(bundle.events)
    setRegistrations(bundle.registrations)
    setStats(bundle.stats)
    router.refresh()
  }

  async function handleCreateRegistration() {
    setIsSaving(true)
    setError(null)
    try {
      const bundle = await createChildcareRegistration({
        childcare_event_id: registrationForm.childcare_event_id,
        child_name: registrationForm.child_name,
        parent_name: registrationForm.parent_name || null,
        child_age: registrationForm.child_age
          ? Number.parseInt(registrationForm.child_age, 10)
          : null,
        allergies: registrationForm.allergies || null,
        notes: registrationForm.notes || null,
        status: registrationForm.status,
      })
      applyBundle(bundle)
      setShowAddDialog(false)
      setRegistrationForm({
        childcare_event_id: "",
        child_name: "",
        parent_name: "",
        child_age: "",
        allergies: "",
        notes: "",
        status: "pending",
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save registration.")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCreateEvent() {
    setIsSaving(true)
    setError(null)
    try {
      const bundle = await createChildcareEvent({
        name: eventForm.name,
        event_date: eventForm.event_date,
        start_time: eventForm.start_time || null,
        end_time: eventForm.end_time || null,
        capacity: Number.parseInt(eventForm.capacity, 10) || 20,
      })
      applyBundle(bundle)
      setShowAddEventDialog(false)
      setEventForm({
        name: "",
        event_date: "",
        start_time: "",
        end_time: "",
        capacity: "20",
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save event.")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleStatusChange(
    registrationId: string,
    status: ChildcareRegistrationStatus
  ) {
    setIsSaving(true)
    setError(null)
    try {
      const bundle = await updateChildcareRegistrationStatus({
        registrationId,
        status,
      })
      applyBundle(bundle)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status.")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleAssignProvider(eventId: string, providerContactId: string) {
    setIsSaving(true)
    setError(null)
    try {
      const bundle = await assignChildcareEventProvider({
        eventId,
        providerContactId: providerContactId === "none" ? null : providerContactId,
      })
      applyBundle(bundle)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign provider.")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRemove(registrationId: string) {
    if (!window.confirm("Remove this registration?")) return
    setIsSaving(true)
    setError(null)
    try {
      const bundle = await deleteChildcareRegistration(registrationId)
      applyBundle(bundle)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove registration.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <Header title="Workforce" />
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Childcare registrations</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage child registrations across events. Open an event workspace for event-specific
            childcare.
          </p>
        </div>
        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-4 [&>*]:w-fit">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Registrations
              </CardTitle>
              <Baby className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Across all events</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Confirmed
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.confirmed}</div>
              <p className="text-xs text-muted-foreground">Ready for childcare</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Waitlisted
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{stats.waitlisted}</div>
              <p className="text-xs text-muted-foreground">Awaiting availability</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending
              </CardTitle>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">Awaiting confirmation</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Upcoming Events with Childcare</CardTitle>
              <CardDescription>Events offering childcare services</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowAddEventDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Event
            </Button>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No upcoming childcare events yet. Add an event to start taking registrations.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {events.map((event) => (
                  <div key={event.id} className="rounded-lg border p-4">
                    <p className="font-medium">{event.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatChildcareDate(event.event_date)}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm">
                        {event.registered_count}/{event.capacity} registered
                      </span>
                      <div className="h-2 w-16 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{
                            width: `${Math.min(
                              100,
                              event.capacity > 0
                                ? (event.registered_count / event.capacity) * 100
                                : 0
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="mt-3 space-y-1">
                      <Label className="text-xs text-muted-foreground">Assigned provider</Label>
                      <Select
                        value={event.assigned_provider_contact_id || "none"}
                        onValueChange={(value) => handleAssignProvider(event.id, value)}
                        disabled={isSaving || providers.length === 0}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue
                            placeholder={
                              providers.length === 0
                                ? "No approved providers"
                                : "Select provider"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Unassigned</SelectItem>
                          {providers.map((provider) => (
                            <SelectItem key={provider.contactId} value={provider.contactId}>
                              {provider.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {event.assigned_provider_name ? (
                        <p className="text-xs text-muted-foreground">
                          Currently: {event.assigned_provider_name}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

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
                {events.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
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
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="waitlisted">Waitlisted</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setShowAddDialog(true)} disabled={events.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            Add Registration
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {registrations.length === 0
                  ? "No childcare registrations yet."
                  : "No registrations match your filters."}
              </p>
            ) : (
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
                      <TableCell className="font-medium">{reg.child_name}</TableCell>
                      <TableCell>{reg.parent_name || "—"}</TableCell>
                      <TableCell>
                        {reg.child_age != null ? `${reg.child_age} yrs` : "—"}
                      </TableCell>
                      <TableCell>{reg.event_name}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{formatChildcareDate(reg.event_date)}</p>
                          <p className="text-muted-foreground">
                            {formatChildcareTimeRange(reg)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            reg.status === "confirmed"
                              ? "default"
                              : reg.status === "waitlisted"
                                ? "secondary"
                                : "outline"
                          }
                          className={statusBadgeClass(reg.status)}
                        >
                          {CHILDCARE_REGISTRATION_STATUS_LABELS[reg.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {reg.allergies ? (
                          <Badge
                            variant="destructive"
                            className="bg-red-100 text-red-800 hover:bg-red-100"
                          >
                            {reg.allergies}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" disabled={isSaving}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {reg.status !== "confirmed" ? (
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(reg.id, "confirmed")}
                              >
                                Mark confirmed
                              </DropdownMenuItem>
                            ) : null}
                            {reg.status !== "pending" ? (
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(reg.id, "pending")}
                              >
                                Mark pending
                              </DropdownMenuItem>
                            ) : null}
                            {reg.status !== "waitlisted" ? (
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(reg.id, "waitlisted")}
                              >
                                Mark waitlisted
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleRemove(reg.id)}
                            >
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
            )}
          </CardContent>
        </Card>
      </div>

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
              <Input
                id="child-name"
                value={registrationForm.child_name}
                onChange={(e) =>
                  setRegistrationForm({ ...registrationForm, child_name: e.target.value })
                }
                placeholder="Enter child's name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="parent-name">Parent Name</Label>
                <Input
                  id="parent-name"
                  value={registrationForm.parent_name}
                  onChange={(e) =>
                    setRegistrationForm({ ...registrationForm, parent_name: e.target.value })
                  }
                  placeholder="Enter parent's name"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="child-age">Age</Label>
                <Input
                  id="child-age"
                  type="number"
                  value={registrationForm.child_age}
                  onChange={(e) =>
                    setRegistrationForm({ ...registrationForm, child_age: e.target.value })
                  }
                  placeholder="Age"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="event">Event</Label>
              <Select
                value={registrationForm.childcare_event_id}
                onValueChange={(value) =>
                  setRegistrationForm({ ...registrationForm, childcare_event_id: value })
                }
              >
                <SelectTrigger id="event">
                  <SelectValue placeholder="Select event" />
                </SelectTrigger>
                <SelectContent>
                  {events.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.name} - {formatChildcareDate(event.event_date)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="registration-status">Status</Label>
              <Select
                value={registrationForm.status}
                onValueChange={(value) =>
                  setRegistrationForm({
                    ...registrationForm,
                    status: value as ChildcareRegistrationStatus,
                  })
                }
              >
                <SelectTrigger id="registration-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="waitlisted">Waitlisted</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="allergies">Allergies</Label>
              <Input
                id="allergies"
                value={registrationForm.allergies}
                onChange={(e) =>
                  setRegistrationForm({ ...registrationForm, allergies: e.target.value })
                }
                placeholder="List any allergies (or None)"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={registrationForm.notes}
                onChange={(e) =>
                  setRegistrationForm({ ...registrationForm, notes: e.target.value })
                }
                placeholder="Any special instructions"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateRegistration}
              disabled={
                isSaving ||
                !registrationForm.child_name.trim() ||
                !registrationForm.childcare_event_id
              }
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add Registration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddEventDialog} onOpenChange={setShowAddEventDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Childcare Event</DialogTitle>
            <DialogDescription>
              Create an event that offers childcare registration
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="event-name">Event Name</Label>
              <Input
                id="event-name"
                value={eventForm.name}
                onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })}
                placeholder="Friday Prayer"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="event-date">Date</Label>
              <Input
                id="event-date"
                type="date"
                value={eventForm.event_date}
                onChange={(e) => setEventForm({ ...eventForm, event_date: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="start-time">Start Time</Label>
                <Input
                  id="start-time"
                  value={eventForm.start_time}
                  onChange={(e) => setEventForm({ ...eventForm, start_time: e.target.value })}
                  placeholder="12:00 PM"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="end-time">End Time</Label>
                <Input
                  id="end-time"
                  value={eventForm.end_time}
                  onChange={(e) => setEventForm({ ...eventForm, end_time: e.target.value })}
                  placeholder="2:00 PM"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="capacity">Capacity</Label>
              <Input
                id="capacity"
                type="number"
                min={1}
                value={eventForm.capacity}
                onChange={(e) => setEventForm({ ...eventForm, capacity: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddEventDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateEvent}
              disabled={isSaving || !eventForm.name.trim() || !eventForm.event_date}
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
