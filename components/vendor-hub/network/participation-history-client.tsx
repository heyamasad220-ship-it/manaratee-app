import Link from "next/link"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import type { ParticipationHistoryRow } from "@/lib/vendor-hub/participation-history-queries"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"

function formatDate(value?: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString()
}

function formatCurrency(amount: number | null) {
  if (amount == null || !Number.isFinite(amount)) return "—"
  return `$${amount.toFixed(2)}`
}

export function ParticipationHistoryClient({
  rows,
  contactIdFilter,
}: {
  rows: ParticipationHistoryRow[]
  contactIdFilter?: string | null
}) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          {contactIdFilter
            ? "No vendor participation history for this contact yet."
            : "No vendor participation history yet. Event participation and booth payments will appear here."}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        One row per vendor — event count and latest participation across bazaars.
      </p>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business Name</TableHead>
                <TableHead>Vendor Type</TableHead>
                <TableHead className="text-right">Events</TableHead>
                <TableHead>Last Event</TableHead>
                <TableHead>Last Event Date</TableHead>
                <TableHead className="text-right">Last Amount Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.contactId}>
                  <TableCell>
                    <Link
                      href={VENDOR_HUB_ROUTES.network.vendor(row.contactId)}
                      className="font-medium text-primary hover:underline"
                    >
                      {row.businessName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{row.vendorType || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.eventCount}</TableCell>
                  <TableCell>
                    {row.lastEventId ? (
                      <Link
                        href={VENDOR_HUB_ROUTES.events.detail(row.lastEventId)}
                        className="hover:text-primary hover:underline"
                      >
                        {row.lastEventName}
                      </Link>
                    ) : (
                      row.lastEventName
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(row.lastEventDate)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(row.lastAmountPaid)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
