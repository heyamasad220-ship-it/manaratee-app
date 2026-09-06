"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Loader2, Star } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchContactVendorEvaluations } from "@/lib/vendor-hub/vendor-evaluation-actions"
import {
  VENDOR_PARTICIPATION_RATING_LABELS,
  type VendorContactEvaluationRow,
  type VendorParticipationRating,
} from "@/lib/vendor-hub/vendor-evaluation-types"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"
import { cn } from "@/lib/utils"

const ratingColors: Record<VendorParticipationRating, string> = {
  excellent: "border-emerald-200 bg-emerald-50 text-emerald-700",
  good: "border-blue-200 bg-blue-50 text-blue-700",
  average: "border-amber-200 bg-amber-50 text-amber-700",
  poor: "border-red-200 bg-red-50 text-red-700",
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function ContactVendorEvaluationsPanel({ contactId }: { contactId: string }) {
  const [rows, setRows] = useState<VendorContactEvaluationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tablesAvailable, setTablesAvailable] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    fetchContactVendorEvaluations(contactId)
      .then((data) => {
        if (!cancelled) {
          setRows(data)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("ContactVendorEvaluationsPanel:", error)
          const message = error instanceof Error ? error.message : ""
          if (message.includes("does not exist") || message.includes("42P01")) {
            setTablesAvailable(false)
          }
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [contactId])

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading bazaar evaluations…
        </CardContent>
      </Card>
    )
  }

  if (!tablesAvailable) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Bazaar evaluations require migration{" "}
          <code className="rounded bg-muted px-1">082_vendor_participation_evaluations.sql</code>.
        </CardContent>
      </Card>
    )
  }

  if (rows.length === 0) {
    return null
  }

  const cautionCount = rows.filter((row) => row.wouldInviteAgain === false).length
  const poorCount = rows.filter((row) => row.rating === "poor" || row.rating === "average").length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Star className="h-4 w-4" />
          Bazaar evaluations
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {cautionCount > 0 ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              {cautionCount} past bazaar
              {cautionCount === 1 ? "" : "s"} flagged as &quot;would not invite again&quot; — review
              notes before assigning future booths.
            </p>
          </div>
        ) : null}

        {rows.map((row) => (
          <div key={row.id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={VENDOR_HUB_ROUTES.events.evaluations(row.eventId)}
                className="font-medium hover:underline"
              >
                {row.eventName}
              </Link>
              <Badge variant="outline" className={cn(ratingColors[row.rating])}>
                {VENDOR_PARTICIPATION_RATING_LABELS[row.rating]}
              </Badge>
              {row.wouldInviteAgain === false ? (
                <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                  Do not invite again
                </Badge>
              ) : row.wouldInviteAgain === true ? (
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                  Would invite again
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDate(row.eventDate)}
              {row.boothNumber ? ` · Booth ${row.boothNumber}` : ""}
              {row.reviewedAt ? ` · Evaluated ${formatDate(row.reviewedAt)}` : ""}
            </p>
            {row.notes ? (
              <p className="mt-2 text-sm text-muted-foreground">{row.notes}</p>
            ) : null}
          </div>
        ))}

        {poorCount > 0 && cautionCount === 0 ? (
          <p className="text-xs text-muted-foreground">
            {poorCount} evaluation{poorCount === 1 ? "" : "s"} rated average or below.
          </p>
        ) : null}

        <Button variant="outline" size="sm" className="w-fit" asChild>
          <Link href={VENDOR_HUB_ROUTES.reportsHistory(contactId)}>
            View full vendor history
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
