"use client"

import Link from "next/link"
import { Download } from "lucide-react"

import { PhoneText } from "@/components/ui/phone-text"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { formatPhoneDisplay } from "@/lib/ui/format-phone"
import type { ParticipationHistoryRow } from "@/lib/vendor-hub/participation-history-queries"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"

function formatDate(value?: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString()
}

function formatCsvDate(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString()
}

function formatCurrency(amount: number | null) {
  if (amount == null || !Number.isFinite(amount)) return "—"
  return `$${amount.toFixed(2)}`
}

function csvEscape(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function downloadParticipationHistoryCsv(rows: ParticipationHistoryRow[]) {
  const header = [
    "Business Name",
    "Primary Contact",
    "Email",
    "Phone",
    "Vendor Type",
    "Events",
    "Last Event",
    "Last Event Date",
    "Last Amount Paid",
  ]
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.businessName,
        row.contactName || "",
        row.email || "",
        formatPhoneDisplay(row.phone),
        row.vendorType || "",
        String(row.eventCount),
        row.lastEventName === "—" ? "" : row.lastEventName,
        formatCsvDate(row.lastEventDate),
        row.lastAmountPaid != null && Number.isFinite(row.lastAmountPaid)
          ? row.lastAmountPaid.toFixed(2)
          : "",
      ]
        .map(csvEscape)
        .join(",")
    ),
  ]
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `vendor-participation-history-${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          One row per vendor — event count and latest participation across bazaars.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => downloadParticipationHistoryCsv(rows)}
        >
          <Download className="mr-1.5 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business Name</TableHead>
                <TableHead>Primary Contact</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
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
                  <TableCell className="text-sm">{row.contactName || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.email || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <PhoneText value={row.phone} />
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
