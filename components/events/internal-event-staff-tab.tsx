"use client"

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type KeyboardEvent,
} from "react"
import { useRouter } from "next/navigation"
import { Pencil, Trash2, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  assignEventStaffMember,
  updateEventStaffAssignment,
} from "@/lib/service-participations/service-participation-actions"
import type { EventStaffCandidate } from "@/lib/events/event-staff-assignment-queries"
import type { ServiceParticipationWithContact } from "@/lib/service-participations/service-participation-types"
import { parseServiceRequirements } from "@/lib/events/event-service-requirements"
import {
  formatVolunteerWindowLabel,
  storedWindowsFromForm,
  volunteerWindowsFromStored,
} from "@/lib/events/volunteer-windows"

type Compensation = "paid" | "volunteer"

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

export function InternalEventStaffAssignments({
  eventId,
  tasks,
  taskDefinitions,
  participations,
  candidates,
  canManage,
  showVolunteers = true,
}: {
  eventId: string
  tasks: string[]
  taskDefinitions?: EventTaskDefinition[]
  participations: ServiceParticipationWithContact[]
  candidates: EventStaffCandidate[]
  canManage: boolean
  /** Paid staff tab hides the volunteer assignment list. */
  showVolunteers?: boolean
}) {
  const definitions = useMemo(() => {
    if (taskDefinitions?.length) return taskDefinitions
    return tasks.map((name) => ({
      name,
      slots: 1,
      description: null,
      staffAllowed: true,
      volunteerAllowed: true,
      shifts: [],
    }))
  }, [taskDefinitions, tasks])

  const people = useMemo(
    () =>
      [...candidates].sort((a, b) =>
        a.full_name.localeCompare(b.full_name, undefined, { sensitivity: "base" })
      ),
    [candidates]
  )

  const paidAssignments = useMemo(
    () =>
      participations.filter(
        (row) => row.participation_type === "staff" && row.status !== "cancelled"
      ),
    [participations]
  )

  const volunteerAssignments = useMemo(
    () =>
      participations.filter(
        (row) =>
          row.participation_type === "volunteer" && row.status !== "cancelled"
      ),
    [participations]
  )

  const summary = useMemo(() => {
    const counted = showVolunteers
      ? [...paidAssignments, ...volunteerAssignments]
      : paidAssignments
    let plannedHours = 0
    let actualHours = 0
    let payrollEstimate = 0
    for (const row of counted) {
      const meta = row.assignment_meta || {}
      const planned = meta.hours ?? 0
      const actual = meta.actualHours ?? meta.hours ?? 0
      plannedHours += planned
      actualHours += actual
      if (row.participation_type === "staff" && meta.hourlyRate != null) {
        payrollEstimate += (meta.hourlyRate || 0) * actual
      }
    }
    const needed = definitions
      .filter((task) => (showVolunteers ? task.volunteerAllowed || task.staffAllowed : task.staffAllowed))
      .reduce((sum, task) => sum + (task.slots || 0), 0)
    const filled = counted.length
    return {
      paidCount: paidAssignments.length,
      volunteerCount: volunteerAssignments.length,
      openAssignments: Math.max(0, needed - filled),
      plannedHours,
      actualHours,
      payrollEstimate,
    }
  }, [definitions, paidAssignments, showVolunteers, volunteerAssignments])

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryCard label="Paid staff" value={String(summary.paidCount)} />
        {showVolunteers ? (
          <SummaryCard label="Volunteers" value={String(summary.volunteerCount)} />
        ) : null}
        <SummaryCard
          label="Open assignments"
          value={String(summary.openAssignments)}
        />
        <SummaryCard
          label="Scheduled hours"
          value={summary.plannedHours.toFixed(1)}
        />
        <SummaryCard
          label="Actual hours"
          value={summary.actualHours.toFixed(1)}
        />
        <SummaryCard
          label="Payroll estimate"
          value={`$${summary.payrollEstimate.toFixed(2)}`}
        />
      </div>

      <StaffAssignmentSection
        title="Paid staff"
        description="Assign paid workers. Enter hours and press Enter or Tab to add another row. Select rows to mark as paid."
        compensation="paid"
        eventId={eventId}
        definitions={definitions.filter((task) => task.staffAllowed)}
        assignments={paidAssignments}
        people={people}
        canManage={canManage}
      />
      {showVolunteers ? (
      <StaffAssignmentSection
        title="Volunteers"
        description="Assign volunteers to a time and slot. Enter hours and press Enter or Tab to add another row. Select rows to send certificates."
        compensation="volunteer"
        eventId={eventId}
        definitions={definitions.filter((task) => task.volunteerAllowed)}
        assignments={volunteerAssignments}
        people={people}
        canManage={canManage}
      />
      ) : null}
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  )
}

function StaffAssignmentSection({
  title,
  description,
  compensation,
  eventId,
  definitions,
  assignments,
  people,
  canManage,
}: {
  title: string
  description: string
  compensation: Compensation
  eventId: string
  definitions: EventTaskDefinition[]
  assignments: ServiceParticipationWithContact[]
  people: EventStaffCandidate[]
  canManage: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [contactId, setContactId] = useState("")
  const [task, setTask] = useState("")
  const [windowId, setWindowId] = useState("")
  const [shiftId, setShiftId] = useState("")
  const [hourlyRate, setHourlyRate] = useState("")
  const [hours, setHours] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<ServiceParticipationWithContact | null>(
    null
  )

  const tasks = definitions.map((row) => row.name)
  const selectedTask = definitions.find((row) => row.name === task)
  const shifts = selectedTask?.shifts || []
  const sheetWindows = useMemo(() => {
    const order: string[] = []
    const map = new Map<
      string,
      { id: string; label: string; slots: EventTaskDefinition[] }
    >()
    for (const definition of definitions) {
      if (!definition.windowId || !definition.slotId) continue
      let window = map.get(definition.windowId)
      if (!window) {
        window = {
          id: definition.windowId,
          label: definition.windowLabel || "Time not set",
          slots: [],
        }
        map.set(definition.windowId, window)
        order.push(definition.windowId)
      }
      window.slots.push(definition)
    }
    return order
      .map((id) => map.get(id))
      .filter((window): window is NonNullable<typeof window> => Boolean(window))
  }, [definitions])
  const useSheet = sheetWindows.length > 0
  const selectedWindow = sheetWindows.find((window) => window.id === windowId)

  useEffect(() => {
    if (useSheet) return
    if (tasks.length > 0 && !tasks.includes(task)) {
      setTask(tasks[0])
      setShiftId("")
    }
  }, [useSheet, tasks, task])

  useEffect(() => {
    if (useSheet) return
    if (shifts.length === 0) {
      setShiftId("")
      return
    }
    if (!shifts.some((shift) => shift.id === shiftId)) {
      setShiftId(shifts[0].id)
    }
  }, [useSheet, shifts, shiftId])

  useEffect(() => {
    if (!useSheet) return
    if (!sheetWindows.some((window) => window.id === windowId)) {
      setWindowId(sheetWindows[0]?.id || "")
    }
  }, [useSheet, sheetWindows, windowId])

  useEffect(() => {
    if (!useSheet) return
    const slots = selectedWindow?.slots || []
    if (!slots.some((slot) => slot.slotId === shiftId)) {
      setShiftId(slots[0]?.slotId || "")
    }
  }, [useSheet, selectedWindow, shiftId])

  useEffect(() => {
    const valid = new Set(assignments.map((row) => row.id))
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => valid.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [assignments])

  const allSelected =
    assignments.length > 0 && assignments.every((row) => selectedIds.has(row.id))
  const someSelected = assignments.some((row) => selectedIds.has(row.id))

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(assignments.map((row) => row.id)) : new Set())
  }

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function handleAssign() {
    setError(null)
    const sheetSlot = useSheet
      ? selectedWindow?.slots.find((slot) => slot.slotId === shiftId)
      : null
    if (useSheet) {
      if (!sheetWindows.length) {
        setError("Add times and slots above first, then assign people here.")
        return
      }
      if (!contactId || !sheetSlot || !selectedWindow) {
        setError("Select a person, time, and slot before adding the assignment.")
        return
      }
    } else {
      if (!tasks.length) {
        setError("Add tasks above first, then assign people here.")
        return
      }
      if (!contactId || !task) {
        setError("Select a person and task before adding the assignment.")
        return
      }
    }
    const shift = shifts.find((row) => row.id === shiftId)
    const assignedTask = sheetSlot?.name || task
    const assignedShiftId = sheetSlot?.slotId || shift?.id || null
    const assignedShiftLabel = sheetSlot
      ? selectedWindow?.label || null
      : shift?.label || null
    startTransition(async () => {
      const rate =
        hourlyRate.trim() === "" ? null : Number.parseFloat(hourlyRate)
      const loggedHours =
        hours.trim() === "" ? null : Number.parseFloat(hours)
      const result = await assignEventStaffMember({
        eventId,
        contactId,
        compensation,
        task: assignedTask,
        hourlyRate:
          compensation === "paid" && rate != null && Number.isFinite(rate)
            ? rate
            : null,
        hours: loggedHours != null && Number.isFinite(loggedHours) ? loggedHours : null,
        shiftId: assignedShiftId,
        shiftLabel: assignedShiftLabel,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      setContactId("")
      setHourlyRate("")
      setHours("")
      router.refresh()
    })
  }

  function handleHoursCommit(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" && event.key !== "Tab") return
    if (event.key === "Tab" && event.shiftKey) return
    if (isPending || !contactId || (useSheet ? !shiftId : !task)) return

    event.preventDefault()
    handleAssign()
  }

  function runBulk(
    patch: (id: string) => Parameters<typeof updateEventStaffAssignment>[0]
  ) {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    setError(null)
    startTransition(async () => {
      for (const id of ids) {
        const result = await updateEventStaffAssignment(patch(id))
        if (!result.success) {
          setError(result.error)
          return
        }
      }
      setSelectedIds(new Set())
      router.refresh()
    })
  }

  function handleMarkPaid() {
    const paidAt = todayIsoDate()
    runBulk((participationId) => ({ participationId, paidAt }))
  }

  function handleSendCertificates() {
    const certificateSentAt = todayIsoDate()
    runBulk((participationId) => ({ participationId, certificateSentAt }))
  }

  function handleDelete(participationId: string) {
    setError(null)
    startTransition(async () => {
      const result = await updateEventStaffAssignment({
        participationId,
        status: "cancelled",
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(participationId)
        return next
      })
      if (editing?.id === participationId) setEditing(null)
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          {title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage ? (
          <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2 lg:col-span-1">
              <Label>Person</Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select person" />
                </SelectTrigger>
                <SelectContent>
                  {people.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      No people found
                    </SelectItem>
                  ) : (
                    people.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.full_name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            {useSheet ? (
              <>
                <div className="space-y-2">
                  <Label>Time</Label>
                  <Select
                    value={windowId || undefined}
                    onValueChange={(next) => {
                      setWindowId(next)
                      setShiftId("")
                    }}
                    disabled={sheetWindows.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {sheetWindows.map((window) => (
                        <SelectItem key={window.id} value={window.id}>
                          {window.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Slot</Label>
                  <Select
                    value={shiftId || undefined}
                    onValueChange={setShiftId}
                    disabled={(selectedWindow?.slots.length || 0) === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select slot" />
                    </SelectTrigger>
                    <SelectContent>
                      {(selectedWindow?.slots || []).map((slot) => (
                        <SelectItem key={slot.slotId} value={slot.slotId || slot.name}>
                          {slot.name} ({slot.slots})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
            <div className="space-y-2">
              <Label>Task</Label>
              <Select
                value={task}
                onValueChange={(next) => {
                  setTask(next)
                  setShiftId("")
                }}
                disabled={tasks.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      tasks.length === 0 ? "Add tasks above" : "Select task"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {tasks.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Shift</Label>
              <Select
                value={shiftId || "__none"}
                onValueChange={(next) =>
                  setShiftId(next === "__none" ? "" : next)
                }
                disabled={shifts.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      shifts.length === 0 ? "No shifts" : "Select shift"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {shifts.length === 0 ? (
                    <SelectItem value="__none">No shifts</SelectItem>
                  ) : (
                    shifts.map((shift) => (
                      <SelectItem key={shift.id} value={shift.id}>
                        {shift.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
              </>
            )}
            {compensation === "paid" ? (
              <div className="space-y-2">
                <Label>Hourly rate</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Optional"
                  value={hourlyRate}
                  onChange={(event) => setHourlyRate(event.target.value)}
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Hours</Label>
              <Input
                type="number"
                min={0}
                step="0.25"
                placeholder="0"
                value={hours}
                onChange={(event) => setHours(event.target.value)}
                onKeyDown={handleHoursCommit}
                disabled={isPending}
              />
            </div>
          </div>
        ) : null}

        {canManage && someSelected ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedIds.size} selected
            </span>
            {compensation === "paid" ? (
              <Button
                type="button"
                size="sm"
                disabled={isPending}
                onClick={handleMarkPaid}
              >
                Mark as paid
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={isPending}
                onClick={handleSendCertificates}
              >
                Send certificates
              </Button>
            )}
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assignments yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {canManage ? (
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={
                          allSelected
                            ? true
                            : someSelected
                              ? "indeterminate"
                              : false
                        }
                        onCheckedChange={(value) => toggleAll(value === true)}
                        aria-label={`Select all ${title.toLowerCase()}`}
                      />
                    </TableHead>
                  ) : null}
                  <TableHead>Person</TableHead>
                  <TableHead>{useSheet ? "Slot" : "Task"}</TableHead>
                  <TableHead>{useSheet ? "Time" : "Shift"}</TableHead>
                  {compensation === "paid" ? (
                    <TableHead>Hourly rate</TableHead>
                  ) : null}
                  <TableHead>Hours</TableHead>
                  <TableHead>
                    {compensation === "paid" ? "Payment" : "Certificate"}
                  </TableHead>
                  {canManage ? <TableHead className="w-[90px]" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((row) => {
                  const meta = row.assignment_meta || {}
                  return (
                    <TableRow key={row.id}>
                      {canManage ? (
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(row.id)}
                            onCheckedChange={(value) =>
                              toggleOne(row.id, value === true)
                            }
                            aria-label={`Select ${row.contact_name}`}
                          />
                        </TableCell>
                      ) : null}
                      <TableCell>
                        <div className="font-medium">{row.contact_name}</div>
                      </TableCell>
                      <TableCell>{row.volunteer_role || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {meta.shiftLabel || "—"}
                      </TableCell>
                      {compensation === "paid" ? (
                        <TableCell>
                          {meta.hourlyRate != null ? `$${meta.hourlyRate}` : "—"}
                        </TableCell>
                      ) : null}
                      <TableCell>{meta.hours ?? "—"}</TableCell>
                      <TableCell>
                        {compensation === "paid"
                          ? meta.paidAt
                            ? `Paid ${meta.paidAt}`
                            : "Unpaid"
                          : meta.certificateSentAt
                            ? `Sent ${meta.certificateSentAt}`
                            : "Not sent"}
                      </TableCell>
                      {canManage ? (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              disabled={isPending}
                              onClick={() => setEditing(row)}
                              aria-label={`Edit ${row.contact_name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              disabled={isPending}
                              onClick={() => handleDelete(row.id)}
                              aria-label={`Remove ${row.contact_name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {editing ? (
          <EditAssignmentDialog
            open
            assignment={editing}
            compensation={compensation}
            tasks={tasks}
            people={people}
            isPending={isPending}
            onOpenChange={(open) => {
              if (!open) setEditing(null)
            }}
            onSave={(values) => {
              setError(null)
              startTransition(async () => {
                const result = await updateEventStaffAssignment({
                  participationId: editing.id,
                  contactId: values.contactId,
                  task: values.task,
                  hourlyRate:
                    compensation === "paid" ? values.hourlyRate : null,
                  hours: values.hours,
                })
                if (!result.success) {
                  setError(result.error)
                  return
                }
                setEditing(null)
                router.refresh()
              })
            }}
            onDelete={() => handleDelete(editing.id)}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}

function EditAssignmentDialog({
  open,
  assignment,
  compensation,
  tasks,
  people,
  isPending,
  onOpenChange,
  onSave,
  onDelete,
}: {
  open: boolean
  assignment: ServiceParticipationWithContact
  compensation: Compensation
  tasks: string[]
  people: EventStaffCandidate[]
  isPending: boolean
  onOpenChange: (open: boolean) => void
  onSave: (values: {
    contactId: string
    task: string
    hourlyRate: number | null
    hours: number | null
  }) => void
  onDelete: () => void
}) {
  const meta = assignment.assignment_meta || {}
  const [contactId, setContactId] = useState(assignment.contact_id)
  const [task, setTask] = useState(assignment.volunteer_role || "")
  const [hourlyRate, setHourlyRate] = useState(
    meta.hourlyRate != null ? String(meta.hourlyRate) : ""
  )
  const [hours, setHours] = useState(meta.hours != null ? String(meta.hours) : "")

  useEffect(() => {
    const nextMeta = assignment.assignment_meta || {}
    setContactId(assignment.contact_id)
    setTask(assignment.volunteer_role || "")
    setHourlyRate(
      nextMeta.hourlyRate != null ? String(nextMeta.hourlyRate) : ""
    )
    setHours(nextMeta.hours != null ? String(nextMeta.hours) : "")
  }, [assignment])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit assignment</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-2">
            <Label>Person</Label>
            <Select value={contactId} onValueChange={setContactId}>
              <SelectTrigger>
                <SelectValue placeholder="Select person" />
              </SelectTrigger>
              <SelectContent>
                {people.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Task</Label>
            <Select
              value={task}
              onValueChange={setTask}
              disabled={tasks.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select task" />
              </SelectTrigger>
              <SelectContent>
                {tasks.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {compensation === "paid" ? (
            <div className="space-y-2">
              <Label>Hourly rate</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="Optional"
                value={hourlyRate}
                onChange={(event) => setHourlyRate(event.target.value)}
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>Hours</Label>
            <Input
              type="number"
              min={0}
              step="0.25"
              placeholder="0"
              value={hours}
              onChange={(event) => setHours(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={onDelete}
          >
            Remove assignment
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isPending || !contactId || !task}
              onClick={() => {
                const rate =
                  hourlyRate.trim() === ""
                    ? null
                    : Number.parseFloat(hourlyRate)
                const loggedHours =
                  hours.trim() === "" ? null : Number.parseFloat(hours)
                onSave({
                  contactId,
                  task,
                  hourlyRate:
                    rate != null && Number.isFinite(rate) ? rate : null,
                  hours:
                    loggedHours != null && Number.isFinite(loggedHours)
                      ? loggedHours
                      : null,
                })
              }}
            >
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function getEventTaskNamesFromRequirements(
  serviceRequirements: unknown
): string[] {
  return getEventTaskDefinitionsFromRequirements(serviceRequirements).map(
    (task) => task.name
  )
}

export type EventTaskDefinition = {
  name: string
  slots: number
  description: string | null
  staffAllowed: boolean
  volunteerAllowed: boolean
  windowId?: string
  windowLabel?: string
  slotId?: string
  shifts: Array<{
    id: string
    start: string
    end: string
    location: string | null
    label: string
  }>
}

export function getEventTaskDefinitionsFromRequirements(
  serviceRequirements: unknown
): EventTaskDefinition[] {
  const parsed = parseServiceRequirements(serviceRequirements)
  const windows = storedWindowsFromForm(
    volunteerWindowsFromStored(parsed.volunteers)
  )
  if (windows.length > 0) {
    return windows.flatMap((window) => {
      const windowLabel = formatVolunteerWindowLabel(window.start, window.end)
      return window.slots.map((slot) => ({
        name: slot.name,
        slots: slot.openings,
        description: null,
        staffAllowed: true,
        volunteerAllowed: true,
        windowId: window.id,
        windowLabel,
        slotId: slot.id,
        shifts: [
          {
            id: slot.id,
            start: window.start,
            end: window.end,
            location: null,
            label: windowLabel,
          },
        ],
      }))
    })
  }

  return (parsed.volunteers?.roles || [])
    .map((role) => {
      const name = role.name.trim()
      if (!name) return null
      const shifts = (role.shifts || [])
        .filter((shift) => shift.start && shift.end)
        .map((shift) => ({
          id: shift.id,
          start: shift.start,
          end: shift.end,
          location: shift.location || null,
          label: `${shift.start}–${shift.end}${
            shift.location ? ` · ${shift.location}` : ""
          }`,
        }))
      return {
        name,
        slots: role.slots || 1,
        description: role.description || null,
        staffAllowed: role.staffAllowed !== false,
        volunteerAllowed: role.volunteerAllowed !== false,
        shifts,
      }
    })
    .filter((role): role is EventTaskDefinition => role != null)
}
