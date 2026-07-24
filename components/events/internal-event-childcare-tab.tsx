"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Baby, Loader2 } from "lucide-react"

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
import { InternalEventParticipationsPanel } from "@/components/events/internal-event-participations-panel"
import { logChildcareEventHoursAction } from "@/lib/child-care/childcare-event-hours"
import { estimateHoursFromTimeRange } from "@/lib/child-care/childcare-event-hours-utils"
import {
  CHILDCARE_REGISTRATION_STATUS_LABELS,
  type ChildcareEventSummary,
  type ChildcareRegistration,
} from "@/lib/child-care/childcare-registration-types"
import type { ServiceParticipationWithContact } from "@/lib/service-participations/service-participation-types"
import {
  formatChildcareAgeGroupLabel,
  parseServiceRequirements,
} from "@/lib/events/event-service-requirements"
import type { InternalEventWithRelations } from "@/lib/events/internal-event-types"
import { departmentGroupWorkspaceHref } from "@/lib/donations/donation-group-path"
import Link from "next/link"

export function InternalEventChildcareTab({
  event,
  childcareEvent,
  registrations,
  providerParticipations,
  canManage,
}: {
  event: InternalEventWithRelations
  childcareEvent: ChildcareEventSummary | null
  registrations: ChildcareRegistration[]
  providerParticipations: ServiceParticipationWithContact[]
  canManage: boolean
}) {
  const router = useRouter()
  const serviceConfig = parseServiceRequirements(event.service_requirements)
  const [logOpen, setLogOpen] = useState(false)
  const [hours, setHours] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

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
      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Baby className="h-4 w-4" />
            Childcare setup
          </CardTitle>
          {canManage && childcareEvent?.assigned_provider_contact_id ? (
            <Button type="button" size="sm" onClick={openLogDialog}>
              Log provider hours
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {success ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
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
          <p className="text-muted-foreground">
            {[
              ...(serviceConfig.childcare?.ageGroups?.length
                ? serviceConfig.childcare.ageGroups.map(
                    (group) =>
                      `${formatChildcareAgeGroupLabel(group.ageRange)} (cap ${group.capacity})`
                  )
                : [
                    serviceConfig.childcare?.ageRange
                      ? `Ages ${serviceConfig.childcare.ageRange}`
                      : null,
                    serviceConfig.childcare?.capacity
                      ? `Capacity ${serviceConfig.childcare.capacity}`
                      : null,
                  ]),
              serviceConfig.childcare?.registrationDeadline
                ? `Registration deadline ${serviceConfig.childcare.registrationDeadline}`
                : null,
            ]
              .flat()
              .filter(Boolean)
              .join(" · ") || "Childcare is enabled for this event."}
          </p>
          {childcareEvent ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="font-medium">Registered children</p>
                <p className="text-muted-foreground">
                  {childcareEvent.registered_count} / {childcareEvent.capacity || "—"}
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
                  {childcareEvent.start_time ? ` · ${childcareEvent.start_time}` : ""}
                  {childcareEvent.end_time ? ` – ${childcareEvent.end_time}` : ""}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">
              Childcare registration opens once the linked childcare session is synced for this
              event.
            </p>
          )}
          {canManage && childcareEvent && !childcareEvent.assigned_provider_contact_id ? (
            <p className="text-xs text-muted-foreground">
              Assign a provider on Event Management → Reports → Childcare Registrations, then
              log hours here.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Child registrations</CardTitle>
          <p className="text-sm text-muted-foreground">
            Children registered for childcare during this event.
          </p>
        </CardHeader>
        <CardContent>
          {registrations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No childcare registrations yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Child</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registrations.map((registration) => (
                  <TableRow key={registration.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{registration.child_name}</p>
                        {registration.child_age != null ? (
                          <p className="text-xs text-muted-foreground">Age {registration.child_age}</p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <p>{registration.parent_name || "—"}</p>
                      {registration.parent_email ? <p>{registration.parent_email}</p> : null}
                      {registration.parent_phone ? <p>{registration.parent_phone}</p> : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {registration.allergies ? `Allergies: ${registration.allergies}` : "—"}
                      {registration.notes ? <p>{registration.notes}</p> : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {CHILDCARE_REGISTRATION_STATUS_LABELS[registration.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
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

      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log provider hours</DialogTitle>
            <DialogDescription>
              Hours go to {event.departments?.name || "the event department"} payroll for{" "}
              {childcareEvent?.assigned_provider_name || "the assigned provider"}, linked to this
              event. After department approval, payroll can be marked paid under HR →
              Payroll.
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
                onChange={(event) => setHours(event.target.value)}
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
                onChange={(event) => setNotes(event.target.value)}
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
    </div>
  )
}
