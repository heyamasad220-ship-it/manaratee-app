"use client"

import Link from "next/link"
import { MapPin } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { BazaarEventReservationRow } from "@/lib/vendor-hub/vendor-hub-types"
import { cn } from "@/lib/utils"

const statusColors: Record<string, string> = {
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
  assigned: "border-emerald-200 bg-emerald-50 text-emerald-700",
  confirmed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  reserved: "border-amber-200 bg-amber-50 text-amber-700",
  payment_pending: "border-amber-200 bg-amber-50 text-amber-700",
  cancelled: "border-red-200 bg-red-50 text-red-700",
}

function formatCurrency(value: number | null) {
  if (value === null) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value)
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function BazaarEventReservationsClient({
  reservations,
}: {
  reservations: BazaarEventReservationRow[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Vendor reservations</CardTitle>
        <CardDescription>
          Approved vendors reserve booths directly for this bazaar — they do not submit a separate
          application per event. Review booth assignments and payment status here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {reservations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No booth reservations yet. When approved vendors reserve booths from My Bazaars or you
            assign them manually, they will appear here.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {reservations.map((row) => {
              const status = row.assignmentStatus ?? row.lifecycleStatus
              const statusClass =
                statusColors[status] ?? "border-border bg-muted text-muted-foreground"

              return (
                <div
                  key={row.id}
                  className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/contacts/${row.contactId}`}
                        className="font-medium hover:underline"
                      >
                        {row.vendorName}
                      </Link>
                      {row.boothNumber ? (
                        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          Booth {row.boothNumber}
                        </span>
                      ) : null}
                    </div>
                    {row.vendorEmail ? (
                      <p className="mt-1 text-sm text-muted-foreground">{row.vendorEmail}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-muted-foreground">
                      Reserved {formatDate(row.reservedAt)} · Fee {formatCurrency(row.feeAmount)}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn("capitalize shrink-0", statusClass)}>
                    {status.replace(/_/g, " ")}
                  </Badge>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
