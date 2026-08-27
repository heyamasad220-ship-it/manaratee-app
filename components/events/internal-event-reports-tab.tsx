"use client"

import Link from "next/link"
import { useMemo } from "react"
import {
  Activity,
  Banknote,
  ClipboardList,
  Download,
  Store,
  Users,
  UsersRound,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  buildEventRecentActivity,
  formatActivityWhen,
} from "@/lib/events/event-recent-activity"
import type { EventAttendeeListItem } from "@/lib/tickets/ticket-order-queries"
import type { ChildcareRegistration } from "@/lib/child-care/childcare-registration-types"
import type { ServiceParticipationWithContact } from "@/lib/service-participations/service-participation-types"
import { formatPhoneDisplay } from "@/lib/ui/format-phone"

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100)
}

function csvEscape(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const lines = [headers.map(csvEscape).join(",")]
  for (const row of rows) {
    lines.push(row.map((cell) => csvEscape(cell)).join(","))
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function InternalEventReportsTab({
  eventId,
  attendees,
  overview,
  staffParticipations = [],
  youthRegistrations = [],
  vendorParticipations = [],
}: {
  eventId: string
  attendees: EventAttendeeListItem[]
  overview: EventOverviewSummary
  staffParticipations?: ServiceParticipationWithContact[]
  youthRegistrations?: ChildcareRegistration[]
  vendorParticipations?: ServiceParticipationWithContact[]
}) {
  const { finance } = overview
  const staffRows = staffParticipations.filter(
    (row) =>
      (row.participation_type === "staff" ||
        row.participation_type === "volunteer") &&
      row.status !== "cancelled"
  )
  const vendorRows = vendorParticipations.filter(
    (row) => row.status !== "cancelled"
  )

  const recentActivity = useMemo(
    () =>
      buildEventRecentActivity({
        attendees,
        staffParticipations: staffRows,
      }),
    [attendees, staffRows]
  )

  return (
    <div className="space-y-4">
      {recentActivity.length > 0 ? (
        <Card className="md:col-span-2 xl:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {recentActivity.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-0.5 border-b pb-2 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span>{item.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatActivityWhen(item.when)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4" />
            Registration & attendance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Export attendee seats for this event ({attendees.length} rows).
          </p>
          <Button
            type="button"
            size="sm"
            onClick={() =>
              downloadCsv(
                `event-${eventId}-attendees.csv`,
                ["attendee", "contact", "contact email", "contact phone", "type", "order", "status", "checked in"],
                attendees.map((row) => [
                  row.attendeeName || "",
                  row.purchaserName || "",
                  row.purchaserEmail || "",
                  row.purchaserPhone || "",
                  row.ticketTypeName || "",
                  row.orderNumber || "",
                  row.status || "",
                  row.checkedInAt || "",
                ])
              )
            }
            disabled={attendees.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Banknote className="h-4 w-4" />
            Ticket sales
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Open org-wide ticketing analytics filtered by days, events, or
            customers.
          </p>
          <Button type="button" size="sm" variant="outline" asChild>
            <Link href="/event-management/ticketing/reports">Open reports</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UsersRound className="h-4 w-4" />
            Youth roster
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            {youthRegistrations.length} youth registration
            {youthRegistrations.length === 1 ? "" : "s"}.
          </p>
          <Button
            type="button"
            size="sm"
            disabled={youthRegistrations.length === 0}
            onClick={() =>
              downloadCsv(
                `event-${eventId}-youth.csv`,
                ["child", "age", "guardian", "phone", "email", "status", "allergies"],
                youthRegistrations.map((row) => [
                  row.child_name || "",
                  row.child_age != null ? String(row.child_age) : "",
                  row.parent_name || "",
                  formatPhoneDisplay(row.parent_phone),
                  row.parent_email || "",
                  row.status || "",
                  row.allergies || "",
                ])
              )
            }
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Staff & volunteers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            {staffRows.length} assignment{staffRows.length === 1 ? "" : "s"}.
          </p>
          <Button
            type="button"
            size="sm"
            disabled={staffRows.length === 0}
            onClick={() =>
              downloadCsv(
                `event-${eventId}-staff.csv`,
                [
                  "person",
                  "type",
                  "task",
                  "shift",
                  "hours",
                  "rate",
                  "paid / certificate",
                ],
                staffRows.map((row) => {
                  const meta = row.assignment_meta || {}
                  return [
                    row.contact_name || "",
                    row.participation_type === "staff" ? "Paid" : "Volunteer",
                    row.volunteer_role || "",
                    meta.shiftLabel || "",
                    meta.hours != null ? String(meta.hours) : "",
                    meta.hourlyRate != null ? String(meta.hourlyRate) : "",
                    meta.paidAt || meta.certificateSentAt || "",
                  ]
                })
              )
            }
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Store className="h-4 w-4" />
            Vendors
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            {vendorRows.length} vendor{vendorRows.length === 1 ? "" : "s"}.
          </p>
          <Button
            type="button"
            size="sm"
            disabled={vendorRows.length === 0}
            onClick={() =>
              downloadCsv(
                `event-${eventId}-vendors.csv`,
                ["vendor", "status", "role / notes"],
                vendorRows.map((row) => [
                  row.contact_name || "",
                  row.status || "",
                  row.volunteer_role || row.notes || "",
                ])
              )
            }
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Banknote className="h-4 w-4" />
            Financial summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            Ticket revenue:{" "}
            <span className="font-medium">
              {formatMoney(finance.ticketRevenueCents, finance.currency)}
            </span>
          </p>
          <p>
            Refunds:{" "}
            <span className="font-medium">
              {formatMoney(finance.refundCents, finance.currency)}
            </span>
          </p>
          <p>
            Expenses:{" "}
            <span className="font-medium">
              {formatMoney(finance.expenseCents, finance.currency)}
            </span>
          </p>
          <p>
            Net:{" "}
            <span className="font-medium">
              {formatMoney(finance.netCents, finance.currency)}
            </span>
          </p>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
