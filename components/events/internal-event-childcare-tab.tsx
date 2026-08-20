"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Baby, Loader2, Search } from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { InternalEventParticipationsPanel } from "@/components/events/internal-event-participations-panel"
import { logChildcareEventHoursAction } from "@/lib/child-care/childcare-event-hours"
import { estimateHoursFromTimeRange } from "@/lib/child-care/childcare-event-hours-utils"
import { setChildcareRegistrationCheckIn, updateChildcareRegistrationForms } from "@/lib/child-care/childcare-registration-actions"
import {
  CHILDCARE_REGISTRATION_STATUS_LABELS,
  type ChildcareEventSummary,
  type ChildcareRegistration,
} from "@/lib/child-care/childcare-registration-types"
import {
  hasMissingYouthForms,
  youthFormsStatusLabel,
} from "@/lib/child-care/youth-forms"
import type { ServiceParticipationWithContact } from "@/lib/service-participations/service-participation-types"
import {
  formatYouthGroupSummary,
  parseServiceRequirements,
} from "@/lib/events/event-service-requirements"
import type { InternalEventWithRelations } from "@/lib/events/internal-event-types"
import { departmentGroupWorkspaceHref } from "@/lib/donations/donation-group-path"
import { Checkbox } from "@/components/ui/checkbox"

function formatWhen(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function checkInStatusLabel(registration: ChildcareRegistration) {
  if (registration.checked_out_at) return "Checked out"
  if (registration.checked_in_at) return "On site"
  return "Not checked in"
}

export function InternalEventChildcareTab({
  event,
  childcareEvent,
  registrations,
  providerParticipations,
  canManage,
  canCheckIn = false,
}: {
  event: InternalEventWithRelations
  childcareEvent: ChildcareEventSummary | null
  registrations: ChildcareRegistration[]
  providerParticipations: ServiceParticipationWithContact[]
  canManage: boolean
  canCheckIn?: boolean
}) {
  const router = useRouter()
  const serviceConfig = parseServiceRequirements(event.service_requirements)
  const youthGroups = serviceConfig.childcare?.groups || []
  const [logOpen, setLogOpen] = useState(false)
  const [hours, setHours] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [checkInError, setCheckInError] = useState<string | null>(null)
  const [pickupByRegistration, setPickupByRegistration] = useState<Record<string, string>>({})
  const [formsTarget, setFormsTarget] = useState<ChildcareRegistration | null>(null)
  const [formsAllergies, setFormsAllergies] = useState("")
  const [formsPhotoConsent, setFormsPhotoConsent] = useState(false)
  const [formsWaiverSigned, setFormsWaiverSigned] = useState(false)
  const [formsWaiverBy, setFormsWaiverBy] = useState("")
  const [formsError, setFormsError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const activeRegistrations = useMemo(
    () => registrations.filter((row) => row.status !== "cancelled"),
    [registrations]
  )

  const summary = useMemo(() => {
    const childcareCapacity = youthGroups
      .filter((group) => group.offering === "childcare")
      .reduce((sum, group) => sum + (group.capacity || 0), 0)
    const fieldTripCapacity = youthGroups
      .filter((group) => group.offering === "field_trip")
      .reduce((sum, group) => sum + (group.capacity || 0), 0)

    const groupSum = (serviceConfig.childcare?.ageGroups || []).reduce(
      (sum, group) => sum + (group.capacity || 0),
      0
    )
    const legacyCapacity =
      youthGroups.length === 0
        ? (serviceConfig.childcare?.capacity ??
            (groupSum || childcareEvent?.capacity || 0))
        : 0

    const totalCapacity =
      childcareCapacity + fieldTripCapacity || legacyCapacity || null
    const totalYouth = activeRegistrations.length

    // Approx fill: assign active registrations to childcare capacity first, remainder to field trip.
    const childcareFilled =
      youthGroups.length > 0
        ? Math.min(totalYouth, childcareCapacity)
        : totalYouth
    const fieldTripFilled =
      youthGroups.length > 0
        ? Math.min(Math.max(0, totalYouth - childcareCapacity), fieldTripCapacity)
        : 0

    const capacityRemaining =
      totalCapacity != null ? Math.max(0, totalCapacity - totalYouth) : null

    const missingForms = activeRegistrations.filter((row) =>
      hasMissingYouthForms(row, serviceConfig.childcare)
    ).length
    const checkedIn = activeRegistrations.filter(
      (row) => row.checked_in_at && !row.checked_out_at
    ).length

    return {
      totalYouth,
      childcareFilled,
      fieldTripFilled,
      capacityRemaining,
      missingForms,
      checkedIn,
    }
  }, [activeRegistrations, childcareEvent?.capacity, serviceConfig.childcare, youthGroups])

  const filteredRegistrations = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return registrations
    return registrations.filter((row) => {
      const haystack = [
        row.child_name,
        row.parent_name,
        row.parent_email,
        row.parent_phone,
        row.notes,
        row.allergies,
        CHILDCARE_REGISTRATION_STATUS_LABELS[row.status],
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [registrations, search])

  const suggestedHours = useMemo(
    () =>
      childcareEvent
        ? estimateHoursFromTimeRange(
            childcareEvent.start_time,
            childcareEvent.end_time
          )
        : null,
    [childcareEvent]
  )

  function openLogDialog() {
    setError(null)
    setSuccess(null)
    setNotes("")
    setHours(suggestedHours != null ? String(suggestedHours) : "")
    setLogOpen(true)
  }

  function handleCheckInAction(
    registrationId: string,
    action: "check_in" | "check_out" | "undo_check_in" | "undo_check_out"
  ) {
    setCheckInError(null)
    startTransition(async () => {
      const result = await setChildcareRegistrationCheckIn({
        registrationId,
        action,
        pickupAuthorization: pickupByRegistration[registrationId],
      })
      if (!result.success) {
        setCheckInError(result.error)
        return
      }
      router.refresh()
    })
  }

  const checkInRoster = useMemo(
    () =>
      activeRegistrations.filter(
        (row) => row.status === "confirmed" || row.status === "pending"
      ),
    [activeRegistrations]
  )

  function handleLogHours() {
    if (!childcareEvent) return
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const parsed = Number(hours)
      const result = await logChildcareEventHoursAction({
        childcareEventId: childcareEvent.id,
        hours: Number.isFinite(parsed) && parsed > 0 ? parsed : null,
        notes: notes || null,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      setSuccess(
        `Hours logged to ${event.departments?.name || "department"} payroll.`
      )
      setLogOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Youth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{summary.totalYouth}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Childcare
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{summary.childcareFilled}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Field Trip
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{summary.fieldTripFilled}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Capacity Remaining
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {summary.capacityRemaining != null ? summary.capacityRemaining : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Missing Forms
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{summary.missingForms}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Checked In
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{summary.checkedIn}</p>
          </CardContent>
        </Card>
      </div>

      {success ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {success}{" "}
          <Link
            href={departmentGroupWorkspaceHref(event.department_id, {
              tab: "financial",
              finance: "payroll",
            })}
            className="underline"
          >
            Open payroll
          </Link>
        </p>
      ) : null}

      <Tabs defaultValue="children" className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="children">Children</TabsTrigger>
          <TabsTrigger value="offerings">Offerings</TabsTrigger>
          <TabsTrigger value="staff">Staff/Providers</TabsTrigger>
          <TabsTrigger value="check-in">Check-In</TabsTrigger>
        </TabsList>

        <TabsContent value="children" className="mt-0 space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Baby className="h-4 w-4" />
                  Children
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Children registered for youth offerings on this event.
                </p>
              </div>
              {registrations.length > 0 ? (
                <div className="relative w-full sm:max-w-xs">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search children…"
                    className="pl-8"
                    aria-label="Search children"
                  />
                </div>
              ) : null}
            </CardHeader>
            <CardContent>
              {registrations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No childcare registrations yet.
                </p>
              ) : filteredRegistrations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No children match “{search.trim()}”.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Child</TableHead>
                      <TableHead>Age</TableHead>
                      <TableHead>Parent/Guardian</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Forms</TableHead>
                      <TableHead>Allergies</TableHead>
                      <TableHead>Notes</TableHead>
                      {canManage ? <TableHead className="w-[120px]" /> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRegistrations.map((registration) => {
                      const hasAllergies =
                        registration.allergies != null &&
                        registration.allergies.trim() !== ""
                      const formsMissing = hasMissingYouthForms(
                        registration,
                        serviceConfig.childcare
                      )
                      return (
                        <TableRow key={registration.id}>
                          <TableCell className="font-medium">
                            {registration.child_name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {registration.child_age != null
                              ? registration.child_age
                              : "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {registration.parent_name || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {registration.parent_phone || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {registration.parent_email || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {
                                CHILDCARE_REGISTRATION_STATUS_LABELS[
                                  registration.status
                                ]
                              }
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={formsMissing ? "destructive" : "secondary"}>
                              {formsMissing ? "Incomplete" : "Complete"}
                            </Badge>
                            {formsMissing ? (
                              <p className="mt-1 max-w-[14rem] text-xs text-muted-foreground">
                                {youthFormsStatusLabel(
                                  registration,
                                  serviceConfig.childcare
                                )}
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            {hasAllergies ? (
                              <span
                                className="inline-flex items-center gap-1 text-amber-700"
                                title={registration.allergies || undefined}
                              >
                                <AlertTriangle className="h-3.5 w-3.5" />
                                <span className="text-xs">Yes</span>
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[12rem] truncate text-sm text-muted-foreground">
                            {registration.notes || "—"}
                          </TableCell>
                          {canManage ? (
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={isPending}
                                onClick={() => {
                                  setFormsError(null)
                                  setFormsTarget(registration)
                                  setFormsAllergies(registration.allergies || "")
                                  setFormsPhotoConsent(registration.photoConsent === true)
                                  setFormsWaiverSigned(Boolean(registration.waiverSignedAt))
                                  setFormsWaiverBy(
                                    registration.waiverSignedBy ||
                                      registration.parent_name ||
                                      ""
                                  )
                                }}
                              >
                                Forms
                              </Button>
                            </TableCell>
                          ) : null}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="offerings" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Youth offerings</CardTitle>
              <p className="text-sm text-muted-foreground">
                Read-only summary of configured childcare and field trip groups.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {youthGroups.length === 0 ? (
                <p className="text-muted-foreground">
                  No youth offering groups configured yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {youthGroups.map((group) => (
                    <li
                      key={group.id}
                      className="rounded-md border px-3 py-2 text-muted-foreground"
                    >
                      {formatYouthGroupSummary(group)}
                    </li>
                  ))}
                </ul>
              )}
              {serviceConfig.childcare?.registrationDeadline ? (
                <p className="text-muted-foreground">
                  Registration deadline{" "}
                  {serviceConfig.childcare.registrationDeadline}
                </p>
              ) : null}
              {serviceConfig.childcare?.requireWaiver ? (
                <p className="text-muted-foreground">
                  Liability waiver required before youth check-in. Upload the
                  waiver PDF under Settings → Event documents.
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Edit offerings in the Youth offerings panel above.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="staff" className="mt-0 space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-base">Provider session</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Linked childcare session and assigned provider for this event.
                </p>
              </div>
              {canManage && childcareEvent?.assigned_provider_contact_id ? (
                <Button type="button" size="sm" onClick={openLogDialog}>
                  Log provider hours
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {childcareEvent ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="font-medium">Registered children</p>
                    <p className="text-muted-foreground">
                      {childcareEvent.registered_count} /{" "}
                      {childcareEvent.capacity || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Assigned provider</p>
                    <p className="text-muted-foreground">
                      {childcareEvent.assigned_provider_name || "Not assigned yet"}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Session</p>
                    <p className="text-muted-foreground">
                      {childcareEvent.event_date}
                      {childcareEvent.start_time
                        ? ` · ${childcareEvent.start_time}`
                        : ""}
                      {childcareEvent.end_time
                        ? ` – ${childcareEvent.end_time}`
                        : ""}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Childcare registration opens once the linked childcare session is
                  synced for this event.
                </p>
              )}
              {canManage &&
              childcareEvent &&
              !childcareEvent.assigned_provider_contact_id ? (
                <p className="text-xs text-muted-foreground">
                  Assign a provider on Event Management → Reports → Childcare
                  Registrations, then log hours here.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <InternalEventParticipationsPanel
            participations={providerParticipations}
            canManage={canManage}
            participationType="childcare_provider"
            title="Childcare providers"
            description="Approved childcare providers who signed up to support this event."
            emptyMessage="No childcare provider sign-ups yet."
          />
        </TabsContent>

        <TabsContent value="check-in" className="mt-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Check-In</CardTitle>
              <p className="text-sm text-muted-foreground">
                Check confirmed children in and out. Pickup authorization is optional
                but recommended before check-in.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {checkInError ? (
                <p className="text-sm text-destructive">{checkInError}</p>
              ) : null}
              {checkInRoster.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No confirmed children on the roster yet.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Child</TableHead>
                        <TableHead>Parent/Guardian</TableHead>
                        <TableHead>Pickup authorized by</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Times</TableHead>
                        {canManage || canCheckIn ? (
                          <TableHead className="text-right">Actions</TableHead>
                        ) : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {checkInRoster.map((registration) => {
                        const onSite =
                          Boolean(registration.checked_in_at) &&
                          !registration.checked_out_at
                        const rowCanCheckIn =
                          canCheckIn &&
                          registration.status === "confirmed" &&
                          !registration.checked_in_at
                        const canCheckOut =
                          canCheckIn && onSite && !registration.checked_out_at
                        const canUndoCheckIn =
                          canCheckIn &&
                          registration.status === "confirmed" &&
                          Boolean(registration.checked_in_at) &&
                          !registration.checked_out_at
                        const canUndoCheckOut =
                          canCheckIn && Boolean(registration.checked_out_at)

                        return (
                          <TableRow key={registration.id}>
                            <TableCell className="font-medium">
                              {registration.child_name}
                              {registration.child_age != null ? (
                                <span className="ml-1 text-xs text-muted-foreground">
                                  (Age {registration.child_age})
                                </span>
                              ) : null}
                              {registration.status === "pending" ? (
                                <Badge variant="outline" className="ml-2">
                                  Pending
                                </Badge>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {registration.parent_name || "—"}
                            </TableCell>
                            <TableCell>
                              {canCheckIn && registration.status === "confirmed" ? (
                                <Input
                                  value={
                                    pickupByRegistration[registration.id] ??
                                    registration.pickup_authorization ??
                                    ""
                                  }
                                  onChange={(event) =>
                                    setPickupByRegistration((current) => ({
                                      ...current,
                                      [registration.id]: event.target.value,
                                    }))
                                  }
                                  placeholder="Guardian name"
                                  className="h-8 min-w-[140px]"
                                  disabled={isPending || onSite}
                                />
                              ) : (
                                registration.pickup_authorization || "—"
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={onSite ? "default" : "outline"}>
                                {checkInStatusLabel(registration)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              <div>In: {formatWhen(registration.checked_in_at)}</div>
                              <div>Out: {formatWhen(registration.checked_out_at)}</div>
                            </TableCell>
                            {canManage || canCheckIn ? (
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  {rowCanCheckIn ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      disabled={isPending}
                                      onClick={() =>
                                        handleCheckInAction(
                                          registration.id,
                                          "check_in"
                                        )
                                      }
                                    >
                                      Check in
                                    </Button>
                                  ) : null}
                                  {canCheckOut ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="secondary"
                                      disabled={isPending}
                                      onClick={() =>
                                        handleCheckInAction(
                                          registration.id,
                                          "check_out"
                                        )
                                      }
                                    >
                                      Check out
                                    </Button>
                                  ) : null}
                                  {canUndoCheckIn ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      disabled={isPending}
                                      onClick={() =>
                                        handleCheckInAction(
                                          registration.id,
                                          "undo_check_in"
                                        )
                                      }
                                    >
                                      Undo in
                                    </Button>
                                  ) : null}
                                  {canUndoCheckOut ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      disabled={isPending}
                                      onClick={() =>
                                        handleCheckInAction(
                                          registration.id,
                                          "undo_check_out"
                                        )
                                      }
                                    >
                                      Undo out
                                    </Button>
                                  ) : null}
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log provider hours</DialogTitle>
            <DialogDescription>
              Hours go to {event.departments?.name || "the event department"} payroll for{" "}
              {childcareEvent?.assigned_provider_name || "the assigned provider"}, linked
              to this event. After department approval, payroll can be marked paid under
              HR → Payroll.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="childcare-hours">Hours</Label>
              <Input
                id="childcare-hours"
                type="number"
                min={0.25}
                max={24}
                step={0.25}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                disabled={isPending}
              />
              {suggestedHours != null ? (
                <p className="text-xs text-muted-foreground">
                  Suggested from session time: {suggestedHours} hours
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="childcare-hours-notes">Notes (optional)</Label>
              <Input
                id="childcare-hours-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isPending}
                placeholder="Extra context for payroll"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setLogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleLogHours} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Log hours"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={formsTarget != null}
        onOpenChange={(open) => {
          if (!open) setFormsTarget(null)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Youth forms{formsTarget ? ` — ${formsTarget.child_name}` : ""}
            </DialogTitle>
            <DialogDescription>
              Record allergies, photo consent, and the liability waiver for this
              child. Incomplete forms block check-in when questions or waiver are
              required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="youth-forms-allergies">Allergies / medical notes</Label>
              <Input
                id="youth-forms-allergies"
                value={formsAllergies}
                onChange={(event) => setFormsAllergies(event.target.value)}
                placeholder="Required when youth questions are on — write None if none"
                disabled={isPending}
              />
            </div>
            <div className="flex items-start gap-2 rounded-md border px-3 py-2">
              <Checkbox
                id="youth-forms-photo"
                checked={formsPhotoConsent}
                onCheckedChange={(checked) => setFormsPhotoConsent(checked === true)}
                disabled={isPending}
              />
              <Label htmlFor="youth-forms-photo" className="font-normal leading-snug">
                Photo / video consent granted
              </Label>
            </div>
            <div className="space-y-2 rounded-md border px-3 py-2">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="youth-forms-waiver"
                  checked={formsWaiverSigned}
                  onCheckedChange={(checked) => setFormsWaiverSigned(checked === true)}
                  disabled={isPending}
                />
                <Label htmlFor="youth-forms-waiver" className="font-normal leading-snug">
                  Liability waiver signed
                </Label>
              </div>
              {formsWaiverSigned ? (
                <div className="space-y-2 pt-2">
                  <Label htmlFor="youth-forms-waiver-by">Signed by</Label>
                  <Input
                    id="youth-forms-waiver-by"
                    value={formsWaiverBy}
                    onChange={(event) => setFormsWaiverBy(event.target.value)}
                    disabled={isPending}
                  />
                </div>
              ) : null}
            </div>
            {formsError ? (
              <p className="text-sm text-destructive">{formsError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormsTarget(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isPending || !formsTarget}
              onClick={() => {
                if (!formsTarget) return
                setFormsError(null)
                startTransition(async () => {
                  const result = await updateChildcareRegistrationForms({
                    registrationId: formsTarget.id,
                    allergies: formsAllergies,
                    photoConsent: formsPhotoConsent,
                    waiverSigned: formsWaiverSigned,
                    waiverSignedBy: formsWaiverBy || null,
                  })
                  if (!result.success) {
                    setFormsError(result.error)
                    return
                  }
                  setFormsTarget(null)
                  router.refresh()
                })
              }}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save forms"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
