"use client"

import { useMemo, useState } from "react"
import { Plus, Search, Store, Users } from "lucide-react"

import { AddEventVendorDialog } from "@/components/vendor-hub/events/add-event-vendor-dialog"
import { EditEventVendorDialog } from "@/components/vendor-hub/events/edit-event-vendor-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { EventBoothOption } from "@/lib/vendor-hub/add-event-vendor-actions"
import type { EventParticipatingVendorRow } from "@/lib/vendor-hub/event-participating-vendors-queries"
import type { VendorHubVendorType } from "@/lib/vendor-hub/vendor-type-types"
import { cn } from "@/lib/utils"

const statusColors: Record<string, string> = {
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
  assigned: "border-emerald-200 bg-emerald-50 text-emerald-700",
  confirmed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  reserved: "border-amber-200 bg-amber-50 text-amber-700",
  payment_pending: "border-amber-200 bg-amber-50 text-amber-700",
  cancelled: "border-red-200 bg-red-50 text-red-700",
  approved: "border-blue-200 bg-blue-50 text-blue-700",
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatStatus(value: string | null) {
  if (!value) return "—"
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export function BazaarEventVendorsClient({
  eventId,
  vendors,
  vendorTypes,
  booths,
}: {
  eventId: string
  vendors: EventParticipatingVendorRow[]
  vendorTypes: VendorHubVendorType[]
  booths: EventBoothOption[]
}) {
  const [search, setSearch] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [editingVendor, setEditingVendor] = useState<EventParticipatingVendorRow | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return vendors
    return vendors.filter((row) => {
      const haystack = [
        row.businessName,
        row.contactName,
        row.email,
        row.phone,
        row.boothType,
        row.boothNumber,
        row.lifecycleStatus,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [search, vendors])

  const paidCount = vendors.filter((row) => row.amountPaid > 0 || row.lifecycleStatus === "paid")
    .length
  const totalPaid = vendors.reduce((sum, row) => sum + row.amountPaid, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Vendors</h1>
        <p className="text-sm text-muted-foreground">
          Vendors who participated in this bazaar event.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Total vendors</p>
              <p className="text-2xl font-semibold tabular-nums">{vendors.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Store className="h-8 w-8 text-emerald-600" />
            <div>
              <p className="text-sm text-muted-foreground">With payments</p>
              <p className="text-2xl font-semibold tabular-nums">{paidCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div>
              <p className="text-sm text-muted-foreground">Amount collected</p>
              <p className="text-2xl font-semibold tabular-nums">{formatCurrency(totalPaid)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">Participating vendors</CardTitle>
              <CardDescription>
                Click a row to edit booth, fee, or remove the vendor from this event.
              </CardDescription>
            </div>
            <Button type="button" size="sm" onClick={() => setAddOpen(true)} className="shrink-0">
              <Plus className="mr-2 h-4 w-4" />
              Add vendor
            </Button>
          </div>
          <div className="relative pt-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search vendors..."
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {vendors.length === 0
                ? "No vendors participated in this event yet."
                : "No vendors match your search."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Booth</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => {
                    const status = row.lifecycleStatus
                    const statusClass =
                      (status && statusColors[status]) ||
                      "border-border bg-muted text-muted-foreground"
                    return (
                      <TableRow
                        key={row.contactId}
                        className="cursor-pointer hover:bg-muted/50"
                        tabIndex={0}
                        role="button"
                        aria-label={`Edit registration for ${row.businessName}`}
                        onClick={() => setEditingVendor(row)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            setEditingVendor(row)
                          }
                        }}
                      >
                        <TableCell>
                          <span className="font-medium text-primary">{row.businessName}</span>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-0">
                            <p className="text-sm">{row.contactName}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {row.email || row.phone || "—"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{row.boothType || "—"}</TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {row.boothNumber?.trim() ? row.boothNumber : "--"}
                        </TableCell>
                        <TableCell>
                          {status ? (
                            <Badge variant="outline" className={cn("font-normal", statusClass)}>
                              {formatStatus(status)}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.amountPaid > 0 ? formatCurrency(row.amountPaid) : "—"}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AddEventVendorDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        eventId={eventId}
        vendorTypes={vendorTypes}
        booths={booths}
        existingContactIds={vendors.map((row) => row.contactId)}
      />

      <EditEventVendorDialog
        open={Boolean(editingVendor)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setEditingVendor(null)
        }}
        eventId={eventId}
        vendor={editingVendor}
        vendorTypes={vendorTypes}
        booths={booths}
      />
    </div>
  )
}
