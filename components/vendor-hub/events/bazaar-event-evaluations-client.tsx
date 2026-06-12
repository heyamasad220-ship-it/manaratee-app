"use client"

import Link from "next/link"
import { useMemo, useState, useTransition } from "react"
import { Loader2, MapPin, Star } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { contactProfilePath } from "@/lib/vendor-hub/contact-centric-model"
import { upsertVendorParticipationEvaluation } from "@/lib/vendor-hub/vendor-evaluation-actions"
import {
  VENDOR_PARTICIPATION_RATING_LABELS,
  VENDOR_PARTICIPATION_RATINGS,
  type VendorEventEvaluationSummary,
  type VendorParticipationRating,
} from "@/lib/vendor-hub/vendor-evaluation-types"
import { cn } from "@/lib/utils"

const ratingColors: Record<VendorParticipationRating, string> = {
  excellent: "border-emerald-200 bg-emerald-50 text-emerald-700",
  good: "border-blue-200 bg-blue-50 text-blue-700",
  average: "border-amber-200 bg-amber-50 text-amber-700",
  poor: "border-red-200 bg-red-50 text-red-700",
}

function EvaluationForm({
  eventId,
  row,
  onSaved,
}: {
  eventId: string
  row: VendorEventEvaluationSummary["rows"][number]
  onSaved: () => void
}) {
  const [rating, setRating] = useState<VendorParticipationRating>(
    row.evaluation?.rating ?? "good"
  )
  const [wouldInviteAgain, setWouldInviteAgain] = useState<string>(
    row.evaluation?.wouldInviteAgain === null || row.evaluation?.wouldInviteAgain === undefined
      ? "unset"
      : row.evaluation.wouldInviteAgain
        ? "yes"
        : "no"
  )
  const [notes, setNotes] = useState(row.evaluation?.notes ?? "")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSave = () => {
    setError(null)
    startTransition(async () => {
      try {
        await upsertVendorParticipationEvaluation({
          eventId,
          contactId: row.contactId,
          boothAssignmentId: row.boothAssignmentId,
          rating,
          wouldInviteAgain:
            wouldInviteAgain === "unset" ? null : wouldInviteAgain === "yes",
          notes,
        })
        onSaved()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save evaluation.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href={contactProfilePath(row.contactId)}
            className="font-medium hover:underline"
          >
            {row.vendorName}
          </Link>
          {row.vendorEmail ? (
            <p className="text-sm text-muted-foreground">{row.vendorEmail}</p>
          ) : null}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {row.boothNumber ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                Booth {row.boothNumber}
              </span>
            ) : null}
            {row.assignmentStatus ? (
              <Badge variant="outline" className="capitalize">
                {row.assignmentStatus.replace(/_/g, " ")}
              </Badge>
            ) : null}
            {row.evaluation ? (
              <Badge variant="outline" className={cn(ratingColors[row.evaluation.rating])}>
                {VENDOR_PARTICIPATION_RATING_LABELS[row.evaluation.rating]}
              </Badge>
            ) : (
              <Badge variant="outline">Not evaluated</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>Participation rating</Label>
          <Select value={rating} onValueChange={(value) => setRating(value as VendorParticipationRating)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VENDOR_PARTICIPATION_RATINGS.map((value) => (
                <SelectItem key={value} value={value}>
                  {VENDOR_PARTICIPATION_RATING_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Invite again?</Label>
          <Select value={wouldInviteAgain} onValueChange={setWouldInviteAgain}>
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unset">Not specified</SelectItem>
              <SelectItem value="yes">Yes — would use again</SelectItem>
              <SelectItem value="no">No — would not use again</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`notes-${row.contactId}`}>Notes (internal)</Label>
        <Textarea
          id={`notes-${row.contactId}`}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Optional notes — e.g. arrived late, left early, cleanliness issues, great crowd engagement…"
          rows={3}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending} size="sm">
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : row.evaluation ? (
            "Update evaluation"
          ) : (
            "Save evaluation"
          )}
        </Button>
      </div>
    </div>
  )
}

export function BazaarEventEvaluationsClient({
  eventId,
  initialSummary,
  eventDate,
}: {
  eventId: string
  initialSummary: VendorEventEvaluationSummary
  eventDate: string | null
}) {
  const [summary, setSummary] = useState(initialSummary)
  const [, startRefresh] = useTransition()

  const progressPercent = useMemo(() => {
    if (summary.participantsTotal === 0) return 0
    return Math.round((summary.evaluatedCount / summary.participantsTotal) * 100)
  }, [summary.evaluatedCount, summary.participantsTotal])

  const eventHasPassed = useMemo(() => {
    if (!eventDate) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return new Date(eventDate) < today
  }, [eventDate])

  const handleSaved = () => {
    startRefresh(async () => {
      const { fetchEventVendorEvaluations } = await import(
        "@/lib/vendor-hub/vendor-evaluation-actions"
      )
      const next = await fetchEventVendorEvaluations(eventId)
      setSummary(next)
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Rate vendor participation after the bazaar. Evaluations are internal — vendors do not see
          ratings or notes. Use notes to record issues or precautions for future events.
        </p>
        {eventHasPassed && summary.pendingCount > 0 ? (
          <p className="mt-2 text-sm font-medium text-amber-700">
            This event has ended — {summary.pendingCount} vendor
            {summary.pendingCount === 1 ? "" : "s"} still need
            {summary.pendingCount === 1 ? "s" : ""} evaluation.
          </p>
        ) : null}
      </div>

      {summary.participantsTotal > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evaluation progress</CardTitle>
            <CardDescription>
              {summary.evaluatedCount} of {summary.participantsTotal} participating vendors evaluated
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={progressPercent} className="h-2" />
          </CardContent>
        </Card>
      ) : null}

      {summary.participantsTotal === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No participating vendors to evaluate yet. Vendors with confirmed booth assignments will
            appear here after the event.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {summary.rows.map((row) => (
            <EvaluationForm key={row.contactId} eventId={eventId} row={row} onSaved={handleSaved} />
          ))}
        </div>
      )}

      <Card className="border-dashed">
        <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
          <Star className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Past evaluations appear on each vendor&apos;s CRM contact profile and in Vendor Network
            participation history — helpful when deciding whether to assign booths at future bazaars.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
