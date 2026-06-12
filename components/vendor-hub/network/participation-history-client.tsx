import Link from "next/link"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { contactProfilePath } from "@/lib/vendor-hub/contact-centric-model"
import type { ParticipationHistoryRow } from "@/lib/vendor-hub/participation-history-queries"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"

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
            : "No vendor participation history yet. Approved applications and booth assignments will appear here."}
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
                <TableHead>Vendor</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.contactId ? (
                      <Link
                        href={contactProfilePath(row.contactId)}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {row.contactName}
                      </Link>
                    ) : (
                      row.contactName
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
                  <TableCell>
                    <Badge variant="outline">{row.activityType.replace(/_/g, " ")}</Badge>
                  </TableCell>
                  <TableCell>
                    {row.activityType === "evaluation" ? (
                      <div className="flex flex-col gap-1">
                        <span className="capitalize">{row.rating ?? row.status}</span>
                        {row.wouldInviteAgain === false ? (
                          <span className="text-xs text-red-600">Would not invite again</span>
                        ) : row.wouldInviteAgain === true ? (
                          <span className="text-xs text-emerald-600">Would invite again</span>
                        ) : null}
                        {row.evaluationNotes ? (
                          <span className="line-clamp-2 text-xs text-muted-foreground">
                            {row.evaluationNotes}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      (row.status ?? "—")
                    )}
                  </TableCell>
                  <TableCell>
                    {row.activityType === "evaluation"
                      ? "—"
                      : row.amount != null
                        ? `$${row.amount.toFixed(2)}`
                        : "—"}
                  </TableCell>
                  <TableCell>
                    {row.occurredAt
                      ? new Date(row.occurredAt).toLocaleDateString()
                      : "—"}
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
