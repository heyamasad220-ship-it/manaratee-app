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
import { contactProfilePath } from "@/lib/vendor-hub/contact-centric-model"
import type { ParticipationHistoryRow } from "@/lib/vendor-hub/participation-history-queries"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"

function formatDate(value?: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString()
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
            : "No vendor participation history yet. Booth payments across bazaars will appear here."}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Cross-event vendor participation. Vendor identity links to CRM contacts — not duplicated here.
      </p>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business Name</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Event Date</TableHead>
                <TableHead>Booth Type</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.contactId ? (
                      <Link
                        href={contactProfilePath(row.contactId)}
                        className="font-medium text-primary hover:underline"
                      >
                        {row.businessName}
                      </Link>
                    ) : (
                      row.businessName
                    )}
                  </TableCell>
                  <TableCell>
                    {row.eventId ? (
                      <Link
                        href={VENDOR_HUB_ROUTES.events.detail(row.eventId)}
                        className="hover:text-primary hover:underline"
                      >
                        {row.eventName}
                      </Link>
                    ) : (
                      row.eventName
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(row.eventDate)}
                  </TableCell>
                  <TableCell className="text-sm">{row.boothType || "—"}</TableCell>
                  <TableCell>
                    {row.amount != null ? `$${row.amount.toFixed(2)}` : "—"}
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
