"use client"

import Link from "next/link"
import { useEffect, useState, useTransition } from "react"
import { ExternalLink, Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  loadOperationalBriefForReservationAction,
  updateOperationalBriefSetupAction,
} from "@/lib/operational-briefs/operational-brief-actions"
import {
  OPERATIONAL_BRIEF_SETUP_STATUSES,
  type OperationalBriefView,
} from "@/lib/operational-briefs/operational-brief-types"
import type { CalendarReservation } from "@/lib/reservations/reservation-types"
import { formatTimeRange } from "@/lib/reservations/reservation-time"

type OperationalBriefPanelProps = {
  reservation: CalendarReservation | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Facilities calendar: show contact/setup only — no source workflow links. */
  hideSourceRecordLink?: boolean
}

function BriefField({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
}) {
  if (value == null || value === "") return null

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm whitespace-pre-wrap">{value}</p>
    </div>
  )
}

export function OperationalBriefPanel({
  reservation,
  open,
  onOpenChange,
  hideSourceRecordLink = false,
}: OperationalBriefPanelProps) {
  const [isPending, startTransition] = useTransition()
  const [brief, setBrief] = useState<OperationalBriefView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [facilityNotes, setFacilityNotes] = useState("")

  useEffect(() => {
    if (!open || !reservation) {
      return
    }

    startTransition(async () => {
      try {
        setError(null)
        const loaded = await loadOperationalBriefForReservationAction(reservation, {
          hideSourceRecordLink,
        })
        setBrief(loaded)
        setFacilityNotes(loaded?.facilityNotes ?? "")
      } catch (loadError) {
        setBrief(null)
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load operational brief."
        )
      }
    })
  }, [open, reservation, hideSourceRecordLink])

  const scheduleLabel =
    brief?.eventDate && brief.startTime && brief.endTime
      ? `${brief.eventDate} · ${brief.startTime.slice(0, 5)} – ${brief.endTime.slice(0, 5)}`
      : reservation
        ? formatTimeRange(reservation.startAt, reservation.endAt)
        : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{brief?.title ?? reservation?.title ?? "Operational Brief"}</SheetTitle>
          <SheetDescription>
            Facility setup information for coordinators. Payment and contract details are not
            shown here.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6 px-1">
          {isPending ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading operational brief...
            </div>
          ) : null}

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {brief ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{brief.sourceTypeLabel}</Badge>
                <Badge variant="outline">{brief.setupStatusLabel}</Badge>
                {brief.sourceStatus && !brief.isFacilitiesOnly ? (
                  <Badge variant="outline">Status: {brief.sourceStatus}</Badge>
                ) : null}
              </div>

              <div className="grid gap-4">
                <BriefField label="Schedule" value={scheduleLabel} />
                <BriefField label="Spaces / rooms" value={brief.spacesLabel} />
                <BriefField label="Expected attendance" value={brief.expectedAttendance} />
                <BriefField
                  label="Chairs per table"
                  value={brief.chairsPerTable}
                />
                <BriefField
                  label="Tables needed"
                  value={
                    brief.expectedAttendance && brief.chairsPerTable
                      ? Math.ceil(brief.expectedAttendance / brief.chairsPerTable)
                      : null
                  }
                />
                <BriefField label="Setup style" value={brief.setupStyle} />
                <BriefField label="Room setup" value={brief.roomSetupNotes} />
                <BriefField label="Equipment needs" value={brief.equipmentNotes} />
                <BriefField label="Food / beverage" value={brief.foodBeverageNotes} />
                <BriefField label="Table covers / linens" value={brief.tableLinenNotes} />
                <BriefField label="Cleanup notes" value={brief.cleanupNotes} />
                <BriefField label="Special accommodations" value={brief.accessibilityNotes} />
                <BriefField label="Special requests" value={brief.specialRequests} />
                <BriefField label="Primary contact" value={brief.primaryContactName} />
                <BriefField label="Email" value={brief.primaryContactEmail} />
                <BriefField label="Phone" value={brief.primaryContactPhone} />
                <BriefField
                  label="Internal coordinator"
                  value={brief.internalCoordinatorName}
                />
                <BriefField
                  label="Coordinator phone"
                  value={brief.internalCoordinatorPhone}
                />
                <BriefField
                  label="Coordinator email"
                  value={brief.internalCoordinatorEmail}
                />
              </div>

              {brief.canEditSetupFields ? (
                <div className="space-y-2">
                  <Label htmlFor="facility_notes">Facility notes</Label>
                  <Textarea
                    id="facility_notes"
                    value={facilityNotes}
                    onChange={(event) => setFacilityNotes(event.target.value)}
                    rows={4}
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={isPending}
                    onClick={() => {
                      startTransition(async () => {
                        try {
                          await updateOperationalBriefSetupAction({
                            briefId: brief.id,
                            facilityNotes,
                            setupStatus: OPERATIONAL_BRIEF_SETUP_STATUSES.readyForSetup,
                          })
                          setBrief({
                            ...brief,
                            facilityNotes,
                            setupStatus: OPERATIONAL_BRIEF_SETUP_STATUSES.readyForSetup,
                            setupStatusLabel: "Ready for setup",
                          })
                        } catch (saveError) {
                          setError(
                            saveError instanceof Error
                              ? saveError.message
                              : "Failed to save facility notes."
                          )
                        }
                      })
                    }}
                  >
                    Save facility notes
                  </Button>
                </div>
              ) : (
                <BriefField label="Facility notes" value={brief.facilityNotes} />
              )}

              {brief.canOpenSourceRecord && brief.sourceRecordHref && !hideSourceRecordLink ? (
                <Button variant="outline" asChild className="w-full">
                  <Link href={brief.sourceRecordHref}>
                    Open source record
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              ) : null}
            </>
          ) : !isPending && !error ? (
            <p className="text-sm text-muted-foreground">
              No operational brief is available for this reservation yet.
            </p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
