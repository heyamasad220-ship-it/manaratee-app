"use client"

import { useEffect, useState, useTransition } from "react"
import { AlertTriangle } from "lucide-react"

import { getDuplicateVenueRentalBlockReportAction } from "@/lib/bookings/venue-rental-actions"
import type { DuplicateVenueRentalBlockReportRow } from "@/lib/bookings/venue-rental-transition-queries"
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

export function VenueRentalTransitionReportPanel() {
  const [isPending, startTransition] = useTransition()
  const [rows, setRows] = useState<DuplicateVenueRentalBlockReportRow[]>([])
  const [legacyNewPairCount, setLegacyNewPairCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    startTransition(async () => {
      try {
        const report = await getDuplicateVenueRentalBlockReportAction()
        setRows(report.rows)
        setLegacyNewPairCount(report.legacyNewPairCount)
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load transition report."
        )
      }
    })
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Transition duplicate block report</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {legacyNewPairCount > 0 ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              {legacyNewPairCount} legacy/new duplicate block
              {legacyNewPairCount === 1 ? "" : "s"} detected. Do not dual-write
              `venue_bookings` and `venue_rentals` for the same rental.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {isPending
              ? "Loading report..."
              : "No legacy/new duplicate blocks detected for this organization."}
          </p>
        )}

        {rows.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Venue</TableHead>
                  <TableHead>Overlap</TableHead>
                  <TableHead>Origin A</TableHead>
                  <TableHead>Origin B</TableHead>
                  <TableHead>Legacy/New</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={`${row.reservationAId}-${row.reservationBId}`}>
                    <TableCell className="font-mono text-xs">{row.venueId.slice(0, 8)}</TableCell>
                    <TableCell className="text-xs">
                      {new Date(row.overlapStart).toLocaleString()} –{" "}
                      {new Date(row.overlapEnd).toLocaleTimeString()}
                    </TableCell>
                    <TableCell className="text-xs">{row.reservationAOrigin}</TableCell>
                    <TableCell className="text-xs">{row.reservationBOrigin}</TableCell>
                    <TableCell>
                      {row.isLegacyNewPair ? (
                        <Badge className="bg-amber-100 text-amber-800">Legacy + New</Badge>
                      ) : (
                        <Badge variant="outline">Other overlap</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
