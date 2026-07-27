import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { TemporaryHoldRow, UpcomingOperationalBriefRow } from "@/lib/operational-briefs/operational-brief-queries"
import { OPERATIONAL_BRIEF_SETUP_STATUS_LABELS } from "@/lib/operational-briefs/operational-brief-types"
import type { MasterCalendarConflictPreview } from "@/lib/operational-briefs/reservation-center-queries"
import { operationalBriefSourceHref } from "@/lib/operational-briefs/brief-source-path"
import { formatTimeRange } from "@/lib/reservations/reservation-time"

type ReservationCenterOpsPanelProps = {
  upcomingBriefs: UpcomingOperationalBriefRow[]
  temporaryHolds: TemporaryHoldRow[]
  conflicts: MasterCalendarConflictPreview
  facilitiesOnly?: boolean
}

function sourceTypeLabel(sourceType: string) {
  switch (sourceType) {
    case "internal_event":
      return "Internal Event"
    case "venue_rental":
      return "Venue Rental"
    case "program":
      return "Program"
    case "maintenance":
      return "Maintenance"
    default:
      return sourceType
  }
}

export function ReservationCenterOpsPanel({
  upcomingBriefs,
  temporaryHolds,
  conflicts,
  facilitiesOnly = false,
}: ReservationCenterOpsPanelProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upcoming operational briefs</CardTitle>
          <CardDescription>
            Facility setup visibility across events, rentals, and programs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingBriefs.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead>Setup</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcomingBriefs.map((brief) => {
                    const sourceHref = operationalBriefSourceHref(
                      brief.sourceType,
                      brief.sourceId
                    )

                    return (
                    <TableRow key={brief.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{brief.title}</p>
                          <Badge variant="outline">{sourceTypeLabel(brief.sourceType)}</Badge>
                          {sourceHref && !facilitiesOnly ? (
                            <Button variant="link" className="h-auto p-0 text-xs" asChild>
                              <Link href={sourceHref}>Open source record</Link>
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {brief.eventDate || "TBD"}
                        {brief.startTime ? ` · ${brief.startTime.slice(0, 5)}` : ""}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {OPERATIONAL_BRIEF_SETUP_STATUS_LABELS[
                            brief.setupStatus as keyof typeof OPERATIONAL_BRIEF_SETUP_STATUS_LABELS
                          ] ?? brief.setupStatus}
                        </Badge>
                      </TableCell>
                    </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No upcoming operational briefs yet. Briefs are created when events, rentals, or
              program schedules are submitted.
            </p>
          )}
          <Button variant="link" className="mt-3 h-auto p-0" asChild>
            <Link href="/facilities/calendar">Open calendar</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Temporary holds</CardTitle>
            <CardDescription>Active venue rental holds awaiting approval or payment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {temporaryHolds.length ? (
              temporaryHolds.map((hold) => (
                <div key={`${hold.venueRentalId}-${hold.startAt}`} className="rounded border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{hold.venueName}</p>
                    <Badge variant="outline">Hold</Badge>
                  </div>
                  <p className="text-muted-foreground">
                    {formatTimeRange(hold.startAt, hold.endAt)}
                  </p>
                  {hold.holdExpiresAt ? (
                    <p className="text-xs text-muted-foreground">
                      Expires {new Date(hold.holdExpiresAt).toLocaleString()}
                    </p>
                  ) : null}
                  {!facilitiesOnly ? (
                    <Button variant="link" className="mt-1 h-auto p-0" asChild>
                      <Link href={`/bookings/rentals/${hold.venueRentalId}`}>
                        View rental workflow
                      </Link>
                    </Button>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No active temporary holds.</p>
            )}
          </CardContent>
        </Card>

        <Card className={conflicts.conflictCount > 0 ? "border-amber-200" : undefined}>
          <CardHeader>
            <CardTitle className="text-base">Schedule conflicts</CardTitle>
            <CardDescription>
              Cross-module space overlaps detected this week ({conflicts.conflictCount} reservation
              {conflicts.conflictCount === 1 ? "" : "s"}).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {conflicts.previews.length ? (
              conflicts.previews.map((preview) => (
                <div key={preview.id} className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">
                  <p className="font-medium text-amber-900">
                    {preview.titleA} ↔ {preview.titleB}
                  </p>
                  <p className="text-amber-800">
                    {preview.sourceTypeA} / {preview.sourceTypeB}
                  </p>
                  <p className="text-xs text-amber-700">{preview.overlapLabel}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No cross-module conflicts detected for the current week.
              </p>
            )}
            <Button variant="link" className="h-auto p-0" asChild>
              <Link href="/facilities/calendar">Review on calendar</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
