import { Baby } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { InternalEventParticipationsPanel } from "@/components/events/internal-event-participations-panel"
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
  const serviceConfig = parseServiceRequirements(event.service_requirements)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Baby className="h-4 w-4" />
            Childcare setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
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
    </div>
  )
}
