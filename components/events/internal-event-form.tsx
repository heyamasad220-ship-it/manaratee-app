"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  addHoursToDatetimeLocal,
  DateTimeInput,
  toDatetimeLocalValue,
} from "@/components/ui/datetime-input"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { EventServiceRequirementsFields } from "@/components/events/event-service-requirements-fields"
import { EventTicketingFields } from "@/components/events/event-ticketing-fields"
import { SetupStyleField } from "@/components/setup-styles/setup-style-field"
import type { Department } from "@/lib/departments/department-types"
import type { EventType } from "@/lib/events/event-type-types"
import type { CalendarVenue } from "@/lib/reservations/reservation-types"
import {
  createInternalEvent,
  submitInternalEventRequest,
  updateInternalEvent,
} from "@/lib/events/internal-event-actions"
import {
  getInternalEventStatusOptions,
  type InternalEventStatus,
} from "@/lib/events/internal-event-status"
import {
  buildServiceRequirementsPayload,
  DEFAULT_EVENT_SERVICE_REQUIREMENTS_FORM,
  serviceRequirementsFormFromEvent,
} from "@/lib/events/event-service-requirements"
import {
  buildTicketingPayload,
  DEFAULT_EVENT_TICKETING_FORM,
  ticketingFormFromEvent,
} from "@/lib/tickets/ticket-types"
import { getEventTicketTypes } from "@/lib/tickets/ticket-type-actions"
import type { InternalEventWithRelations } from "@/lib/events/internal-event-types"
import type { InternalEventFormDefaults } from "@/lib/events/internal-event-form-defaults"
import type { RoomSetupStyle } from "@/lib/setup-styles/setup-style-types"
import type { VendorHubVendorType } from "@/lib/vendor-hub/vendor-type-types"

type InternalEventFormProps = (
  | {
      mode: "create"
      departments: Department[]
      eventTypes: EventType[]
      venues: CalendarVenue[]
      initialSlot?: {
        venueId?: string
        startAt?: string
        endAt?: string
      }
      defaults?: InternalEventFormDefaults
    }
  | {
      mode: "request"
      departments: Department[]
      eventTypes: EventType[]
      venues: CalendarVenue[]
      requestOrigin?: "member-staff" | "staff-dashboard"
      initialSlot?: {
        venueId?: string
        startAt?: string
        endAt?: string
      }
      defaults?: InternalEventFormDefaults
    }
  | {
      mode: "edit"
      event: InternalEventWithRelations
      departments: Department[]
      eventTypes: EventType[]
      venues: CalendarVenue[]
    }
) & {
  setupStyles: RoomSetupStyle[]
  canManageSetupStyles?: boolean
  vendorTypes?: VendorHubVendorType[]
  canManageVendorTypes?: boolean
}

export function InternalEventForm(props: InternalEventFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const formDefaults =
    props.mode === "create" || props.mode === "request" ? props.defaults : undefined

  const initial =
    props.mode === "edit"
      ? {
          name: props.event.name,
          description: props.event.description || "",
          department_id: props.event.department_id,
          event_type_id: props.event.event_type_id,
          status: props.event.status,
          start_at: toDatetimeLocalValue(props.event.start_at),
          end_at: toDatetimeLocalValue(props.event.end_at),
          venue_id: props.event.venue_id || "",
          location_label: props.event.location_label || "",
        }
      : props.mode === "request"
        ? {
            name: "",
            description: "",
            department_id: formDefaults?.departmentId || "",
            event_type_id: props.eventTypes[0]?.id || "",
            status: "awaiting_approval" as InternalEventStatus,
            start_at: props.initialSlot?.startAt
              ? toDatetimeLocalValue(props.initialSlot.startAt)
              : "",
            end_at: props.initialSlot?.endAt
              ? toDatetimeLocalValue(props.initialSlot.endAt)
              : "",
            venue_id: props.initialSlot?.venueId || "",
            location_label: "",
          }
        : {
            name: "",
            description: "",
            department_id: formDefaults?.departmentId || "",
            event_type_id: props.eventTypes[0]?.id || "",
            status: "draft" as InternalEventStatus,
            start_at: props.mode === "create" ? props.initialSlot?.startAt || "" : "",
            end_at: props.mode === "create" ? props.initialSlot?.endAt || "" : "",
            venue_id: props.mode === "create" ? props.initialSlot?.venueId || "" : "",
            location_label: "",
          }

  const requestOrigin =
    props.mode === "request"
      ? props.requestOrigin ?? "staff-dashboard"
      : "staff-dashboard"
  const isMemberStaffRequest =
    props.mode === "request" && requestOrigin === "member-staff"

  const [form, setForm] = useState(initial)
  const [serviceRequirements, setServiceRequirements] =
    useState<typeof DEFAULT_EVENT_SERVICE_REQUIREMENTS_FORM>(() =>
      props.mode === "edit"
        ? serviceRequirementsFormFromEvent(props.event)
        : DEFAULT_EVENT_SERVICE_REQUIREMENTS_FORM
    )
  const [ticketing, setTicketing] = useState<typeof DEFAULT_EVENT_TICKETING_FORM>(
    DEFAULT_EVENT_TICKETING_FORM
  )
  const [ticketingLoaded, setTicketingLoaded] = useState(props.mode !== "edit")
  const [operationalSetup, setOperationalSetup] = useState({
    expectedAttendance: "",
    setupStyle: "",
    roomSetupNotes: "",
    equipmentNotes: "",
    accessibilityNotes: "",
  })
  const statusOptions = getInternalEventStatusOptions(props.mode !== "create")

  useEffect(() => {
    if (props.mode !== "edit") return

    const event = props.event
    let cancelled = false

    async function loadTicketing() {
      try {
        const ticketTypes = await getEventTicketTypes(event.id)
        if (cancelled) return
        setTicketing(
          ticketingFormFromEvent({
            requires_ticketing: event.requires_ticketing,
            ticketing_config: event.ticketing_config,
            ticketTypes,
          })
        )
      } catch {
        if (!cancelled) {
          setTicketing(
            ticketingFormFromEvent({
              requires_ticketing: event.requires_ticketing,
              ticketing_config: event.ticketing_config,
              ticketTypes: [],
            })
          )
        }
      } finally {
        if (!cancelled) {
          setTicketingLoaded(true)
        }
      }
    }

    void loadTicketing()

    return () => {
      cancelled = true
    }
  }, [props.mode, props.mode === "edit" ? props.event.id : ""])

  function buildOperationalSetupPayload() {
    const hasAny =
      operationalSetup.expectedAttendance ||
      operationalSetup.setupStyle ||
      operationalSetup.roomSetupNotes ||
      operationalSetup.equipmentNotes ||
      operationalSetup.accessibilityNotes

    if (!hasAny) return undefined

    return {
      expectedAttendance: operationalSetup.expectedAttendance
        ? Number.parseInt(operationalSetup.expectedAttendance, 10)
        : null,
      setupStyle: operationalSetup.setupStyle.trim() || null,
      roomSetupNotes: operationalSetup.roomSetupNotes.trim() || null,
      equipmentNotes: operationalSetup.equipmentNotes.trim() || null,
      accessibilityNotes: operationalSetup.accessibilityNotes.trim() || null,
    }
  }

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value }

      if (key === "start_at" && typeof value === "string" && value) {
        const endIsMissing = !current.end_at
        const endIsBeforeStart =
          current.end_at && new Date(current.end_at) <= new Date(value)

        if (endIsMissing || endIsBeforeStart) {
          next.end_at = addHoursToDatetimeLocal(value, 1)
        }
      }

      return next
    })
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    startTransition(async () => {
      try {
        const servicePayload = buildServiceRequirementsPayload(serviceRequirements)
        const ticketingPayload = buildTicketingPayload(ticketing)

        if (props.mode === "request") {
          const id = await submitInternalEventRequest({
            name: form.name,
            description: form.description,
            department_id: form.department_id,
            event_type_id: form.event_type_id,
            start_at: form.start_at || null,
            end_at: form.end_at || null,
            venue_id: form.venue_id || null,
            location_label: form.location_label,
            operationalSetup: buildOperationalSetupPayload(),
            ...servicePayload,
            ...ticketingPayload,
          })
          router.push(
            isMemberStaffRequest
              ? "/customer/staff/events"
              : `/event-management/${id}`
          )
          router.refresh()
          return
        }

        if (props.mode === "create") {
          const id = await createInternalEvent({
            name: form.name,
            description: form.description,
            department_id: form.department_id,
            event_type_id: form.event_type_id,
            status: form.status,
            start_at: form.start_at || null,
            end_at: form.end_at || null,
            venue_id: form.venue_id || null,
            location_label: form.location_label,
            operationalSetup: buildOperationalSetupPayload(),
            ...servicePayload,
            ...ticketingPayload,
          })
          router.push(`/event-management/${id}`)
          router.refresh()
          return
        }

        await updateInternalEvent({
          id: props.event.id,
          name: form.name,
          description: form.description,
          department_id: form.department_id,
          event_type_id: form.event_type_id,
          status: form.status,
          start_at: form.start_at || null,
          end_at: form.end_at || null,
          venue_id: form.venue_id || null,
          location_label: form.location_label,
          operationalSetup: buildOperationalSetupPayload(),
          ...servicePayload,
          ...ticketingPayload,
        })
        router.refresh()
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Failed to save event"
        )
      }
    })
  }

  const backHref =
    props.mode === "edit"
      ? `/event-management/${props.event.id}`
      : props.mode === "request"
        ? isMemberStaffRequest
          ? "/customer/staff"
          : "/facilities/availability"
        : "/event-management"

  const isRequestMode = props.mode === "request"

  const prefilledDepartment =
    formDefaults?.departmentId &&
    props.departments.find((department) => department.id === formDefaults.departmentId)

  const selectClassName =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

  function renderRequestSidebar() {
    return (
      <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start lg:border-r lg:pr-6">
        {formDefaults?.user ? (
          <div className="space-y-1.5">
            <Label htmlFor="requesting_user">User</Label>
            <Input
              id="requesting_user"
              value={formDefaults.user.name}
              readOnly
              disabled
              className="bg-muted"
            />
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="department">Department</Label>
          {prefilledDepartment ? (
            <Input
              id="department"
              value={prefilledDepartment.name}
              readOnly
              disabled
              className="bg-muted"
            />
          ) : (
            <select
              id="department"
              value={form.department_id}
              onChange={(event) => updateField("department_id", event.target.value)}
              className={selectClassName}
              required
            >
              <option value="">Select department</option>
              {props.departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="event_type">Event type</Label>
          <select
            id="event_type"
            value={form.event_type_id}
            onChange={(event) => updateField("event_type_id", event.target.value)}
            className={selectClassName}
            required
          >
            <option value="">Select type</option>
            {props.eventTypes.map((eventType) => (
              <option key={eventType.id} value={eventType.id}>
                {eventType.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="start_at">Start</Label>
          <DateTimeInput
            id="start_at"
            value={form.start_at}
            onChange={(value) => updateField("start_at", value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="end_at">End</Label>
          <DateTimeInput
            id="end_at"
            value={form.end_at}
            min={form.start_at || undefined}
            onChange={(value) => updateField("end_at", value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="venue_id">Venue</Label>
          <select
            id="venue_id"
            value={form.venue_id}
            onChange={(event) => updateField("venue_id", event.target.value)}
            className={selectClassName}
            required
          >
            <option value="">Select venue</option>
            {props.venues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name}
              </option>
            ))}
          </select>
        </div>

        <SetupStyleField
          value={operationalSetup.setupStyle}
          setupStyles={props.setupStyles}
          canManage={props.canManageSetupStyles}
          onChange={(value) =>
            setOperationalSetup((current) => ({
              ...current,
              setupStyle: value,
            }))
          }
        />

        <div className="space-y-1.5">
          <Label htmlFor="expected_attendance">Expected attendance</Label>
          <Input
            id="expected_attendance"
            type="number"
            min={1}
            value={operationalSetup.expectedAttendance}
            onChange={(event) =>
              setOperationalSetup((current) => ({
                ...current,
                expectedAttendance: event.target.value,
              }))
            }
          />
        </div>
      </aside>
    )
  }

  function renderScheduleAndLocation() {
    return (
      <>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="start_at">Start</Label>
            <DateTimeInput
              id="start_at"
              value={form.start_at}
              onChange={(value) => updateField("start_at", value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="end_at">End</Label>
            <DateTimeInput
              id="end_at"
              value={form.end_at}
              min={form.start_at || undefined}
              onChange={(value) => updateField("end_at", value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="venue_id">Venue</Label>
          <select
            id="venue_id"
            value={form.venue_id}
            onChange={(event) => updateField("venue_id", event.target.value)}
            className={selectClassName}
            required={isRequestMode}
          >
            <option value="">
              {isRequestMode ? "Select venue" : "Select venue (optional)"}
            </option>
            {props.venues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name}
              </option>
            ))}
          </select>
        </div>
      </>
    )
  }

  function renderOperationalSetup(
    compact = false,
    includeSetupStyle = true,
    includeExpectedAttendance = true
  ) {
    return (
      <div className={compact ? "space-y-3 rounded-lg border p-3" : "space-y-4 rounded-lg border p-4"}>
        <div>
          <h3 className="text-sm font-semibold">Facility setup</h3>
          <p className="text-xs text-muted-foreground">
            Shared with facility coordinators on the master calendar.
          </p>
        </div>
        {includeExpectedAttendance || includeSetupStyle ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {includeExpectedAttendance ? (
              <div className="space-y-1.5">
                <Label htmlFor="expected_attendance">Expected attendance</Label>
                <Input
                  id="expected_attendance"
                  type="number"
                  min={1}
                  value={operationalSetup.expectedAttendance}
                  onChange={(event) =>
                    setOperationalSetup((current) => ({
                      ...current,
                      expectedAttendance: event.target.value,
                    }))
                  }
                />
              </div>
            ) : null}
            {includeSetupStyle ? (
              <SetupStyleField
                value={operationalSetup.setupStyle}
                setupStyles={props.setupStyles}
                canManage={props.canManageSetupStyles}
                onChange={(value) =>
                  setOperationalSetup((current) => ({
                    ...current,
                    setupStyle: value,
                  }))
                }
              />
            ) : null}
          </div>
        ) : null}
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="room_setup_notes">Room setup notes</Label>
            <Textarea
              id="room_setup_notes"
              value={operationalSetup.roomSetupNotes}
              onChange={(event) =>
                setOperationalSetup((current) => ({
                  ...current,
                  roomSetupNotes: event.target.value,
                }))
              }
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="equipment_notes">Equipment / AV needs</Label>
            <Textarea
              id="equipment_notes"
              value={operationalSetup.equipmentNotes}
              onChange={(event) =>
                setOperationalSetup((current) => ({
                  ...current,
                  equipmentNotes: event.target.value,
                }))
              }
              rows={2}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="accessibility_notes">Special accommodations</Label>
          <Textarea
            id="accessibility_notes"
            value={operationalSetup.accessibilityNotes}
            onChange={(event) =>
              setOperationalSetup((current) => ({
                ...current,
                accessibilityNotes: event.target.value,
              }))
            }
            rows={2}
          />
        </div>
      </div>
    )
  }

  function renderFormActions() {
    return (
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" asChild disabled={isPending}>
          <Link href={backHref}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : props.mode === "create" ? (
            "Create Event"
          ) : isRequestMode ? (
            "Submit Request"
          ) : (
            "Save Changes"
          )}
        </Button>
      </div>
    )
  }

  return (
    <div
      className={
        isRequestMode
          ? "mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 sm:p-6"
          : "mx-auto flex w-full max-w-3xl flex-col gap-6 p-6"
      }
    >
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={backHref}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {props.mode === "edit"
              ? "Edit Event"
              : isRequestMode
                ? "Request Event"
                : "Create Event"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isRequestMode
              ? "Submit a department event request for supervisor approval."
              : "Department-owned internal events for your organization."}
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className={
          isRequestMode
            ? "space-y-4 rounded-lg border bg-card p-4 sm:p-5"
            : "space-y-6 rounded-lg border bg-card p-6"
        }
      >
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {isRequestMode ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)] lg:gap-6">
            {renderRequestSidebar()}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Event name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="Community Iftar"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(event) => updateField("description", event.target.value)}
                  rows={3}
                  placeholder="Optional details for staff planning"
                />
              </div>

              <EventServiceRequirementsFields
                value={serviceRequirements}
                onChange={setServiceRequirements}
                vendorTypes={props.vendorTypes}
                canManageVendorTypes={props.canManageVendorTypes}
              />

              {ticketingLoaded ? (
                <EventTicketingFields value={ticketing} onChange={setTicketing} />
              ) : (
                <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                  Loading ticketing settings...
                </div>
              )}

              {renderOperationalSetup(true, false, false)}
              {renderFormActions()}
            </div>
          </div>
        ) : (
          <>
        <div className="space-y-2">
          <Label htmlFor="name">Event name</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="Community Iftar"
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <select
              id="department"
              value={form.department_id}
              onChange={(event) => updateField("department_id", event.target.value)}
              className={selectClassName}
              required
            >
              <option value="">Select department</option>
              {props.departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="event_type">Event type</Label>
            <select
              id="event_type"
              value={form.event_type_id}
              onChange={(event) => updateField("event_type_id", event.target.value)}
              className={selectClassName}
              required
            >
              <option value="">Select type</option>
              {props.eventTypes.map((eventType) => (
                <option key={eventType.id} value={eventType.id}>
                  {eventType.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!isRequestMode ? (
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              value={form.status}
              onChange={(event) =>
                updateField("status", event.target.value as InternalEventStatus)
              }
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:max-w-xs"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {renderScheduleAndLocation()}

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={form.description}
            onChange={(event) => updateField("description", event.target.value)}
            rows={4}
            placeholder="Optional details for staff planning"
          />
        </div>

        <EventServiceRequirementsFields
          value={serviceRequirements}
          onChange={setServiceRequirements}
          vendorTypes={props.vendorTypes}
          canManageVendorTypes={props.canManageVendorTypes}
        />

        {ticketingLoaded ? (
          <EventTicketingFields value={ticketing} onChange={setTicketing} />
        ) : (
          <div className="rounded-lg border p-4 text-sm text-muted-foreground">
            Loading ticketing settings...
          </div>
        )}

        {renderOperationalSetup()}
        {renderFormActions()}
          </>
        )}
      </form>
    </div>
  )
}
