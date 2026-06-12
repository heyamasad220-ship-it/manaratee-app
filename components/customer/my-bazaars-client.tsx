"use client"

import { useMemo } from "react"
import { Building2, CalendarDays, MapPin, Store } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ReservableBazaarEvent } from "@/lib/vendor-hub/vendor-participation-model"
import type { VendorInboxMessage } from "@/lib/vendor-hub/vendor-announcement-types"
import type { MyVendorBazaarSummary, VendorBazaarActivityRow } from "@/lib/vendor-hub/vendor-portal-types"
import { OpenBazaarsSection } from "@/components/customer/open-bazaars-section"
import { VendorInboxSection } from "@/components/customer/vendor-inbox-section"
import { VendorPaymentDueSection } from "@/components/customer/vendor-booth-pay-now-section"
import { cn } from "@/lib/utils"

const activityLabels: Record<VendorBazaarActivityRow["activityType"], string> = {
  application: "Vendor onboarding",
  participation: "Participation",
  booth_assignment: "Booth reservation",
  payment: "Payment",
}

const statusColors: Record<string, string> = {
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
  assigned: "border-emerald-200 bg-emerald-50 text-emerald-700",
  pending_review: "border-amber-200 bg-amber-50 text-amber-700",
  submitted: "border-amber-200 bg-amber-50 text-amber-700",
  under_review: "border-amber-200 bg-amber-50 text-amber-700",
  rejected: "border-red-200 bg-red-50 text-red-700",
  cancelled: "border-red-200 bg-red-50 text-red-700",
  payment: "border-blue-200 bg-blue-50 text-blue-700",
  refund: "border-blue-200 bg-blue-50 text-blue-700",
}

function formatDate(value: string | null) {
  if (!value) return "Date not set"
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatCurrency(value: number | null) {
  if (value === null) return null
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value)
}

function ActivityRow({ row }: { row: VendorBazaarActivityRow }) {
  const statusClass =
    statusColors[row.status ?? ""] ?? "border-border bg-muted text-muted-foreground"

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{row.eventName}</p>
          <Badge variant="outline">{activityLabels[row.activityType]}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{row.organizationName}</p>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
          {row.eventDate ? (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatDate(row.eventDate)}
            </span>
          ) : null}
          {row.boothNumber ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              Booth {row.boothNumber}
            </span>
          ) : null}
          {row.amount !== null ? (
            <span>{formatCurrency(row.amount)}</span>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
        {row.status ? (
          <Badge variant="outline" className={cn("capitalize", statusClass)}>
            {row.status.replace(/_/g, " ")}
          </Badge>
        ) : null}
        {row.occurredAt ? (
          <span className="text-xs text-muted-foreground">
            Updated {formatDate(row.occurredAt)}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export function MyBazaarsClient({
  summary,
  reservableEvents = [],
  inboxMessages = [],
}: {
  summary: MyVendorBazaarSummary
  reservableEvents?: ReservableBazaarEvent[]
  inboxMessages?: VendorInboxMessage[]
}) {
  const groupedByOrganization = useMemo(() => {
    const groups = new Map<
      string,
      { organizationName: string; rows: VendorBazaarActivityRow[] }
    >()

    for (const row of summary.rows) {
      const key = row.organizationId || row.organizationName
      const existing = groups.get(key) ?? {
        organizationName: row.organizationName,
        rows: [],
      }
      existing.rows.push(row)
      groups.set(key, existing)
    }

    return [...groups.values()]
  }, [summary.rows])

  if (!summary.tablesAvailable) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Vendor activity is unavailable until migration{" "}
          <code className="rounded bg-muted px-1">079_vendor_portal_rls.sql</code> is applied in
          Supabase.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Bazaars</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Apply once per organization, then reserve booths on open bazaars. Your assignments and
          payments across every community appear here — one login, no duplicate profiles.
        </p>
      </div>

      <VendorInboxSection messages={inboxMessages} />

      <VendorPaymentDueSection items={summary.paymentDue} />

      <OpenBazaarsSection events={reservableEvents} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Communities</p>
            <p className="text-2xl font-bold">{summary.organizationCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Linked profiles</p>
            <p className="text-2xl font-bold">{summary.linkedContactCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Upcoming events</p>
            <p className="text-2xl font-bold">{summary.upcomingEventCount}</p>
          </CardContent>
        </Card>
      </div>

      {summary.linkedContactCount === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No vendor activity linked yet</CardTitle>
            <CardDescription>
              When you apply to become a vendor for an organization using the same email as this
              account, your history will appear here automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Submit a one-time vendor application from your community profile. After approval you can
            reserve booths on published bazaars without applying again.
          </CardContent>
        </Card>
      ) : summary.rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No bazaar activity yet</CardTitle>
            <CardDescription>
              You are linked to {summary.organizationCount}{" "}
              {summary.organizationCount === 1 ? "community" : "communities"}. Vendor
              applications and booth assignments will show up here once organizers process them.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        groupedByOrganization.map((group) => (
          <Card key={group.organizationName}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4" />
                {group.organizationName}
              </CardTitle>
              <CardDescription>
                {group.rows.length} activity record{group.rows.length === 1 ? "" : "s"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {group.rows.map((row) => (
                <ActivityRow key={row.id} row={row} />
              ))}
            </CardContent>
          </Card>
        ))
      )}

      {summary.linkedContactCount > 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
            <Store className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Each organizer keeps their own CRM contact for you. This page combines your
              participation history using your login — you do not need a separate account per
              organization.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
