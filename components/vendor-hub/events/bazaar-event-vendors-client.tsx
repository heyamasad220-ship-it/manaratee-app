"use client"

import { useMemo, useState } from "react"
import { Plus, Store, Users } from "lucide-react"

import { BoothOrdersTable } from "@/components/vendor-hub/booth-orders-table"
import { AddEventVendorDialog } from "@/components/vendor-hub/events/add-event-vendor-dialog"
import { EditEventVendorDialog } from "@/components/vendor-hub/events/edit-event-vendor-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  boothOrderToParticipatingVendor,
  formatBoothOrderMoney,
  type BoothOrderRow,
} from "@/lib/vendor-hub/booth-orders"
import type { EventBoothOption } from "@/lib/vendor-hub/add-event-vendor-actions"
import type { EventParticipatingVendorRow } from "@/lib/vendor-hub/event-participating-vendors-queries"
import type { VendorHubVendorType } from "@/lib/vendor-hub/vendor-type-types"

export function BazaarEventVendorsClient({
  eventId,
  orders,
  vendorTypes,
  booths,
}: {
  eventId: string
  orders: BoothOrderRow[]
  vendorTypes: VendorHubVendorType[]
  booths: EventBoothOption[]
}) {
  const [addOpen, setAddOpen] = useState(false)
  const [editingVendor, setEditingVendor] = useState<EventParticipatingVendorRow | null>(null)

  const uniqueContactIds = useMemo(
    () => [...new Set(orders.map((row) => row.contactId))],
    [orders]
  )
  const paidCount = uniqueContactIds.filter((contactId) =>
    orders.some((row) => row.contactId === contactId && row.paid > 0)
  ).length
  const totalPaid = orders.reduce((sum, row) => sum + row.paid, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Orders</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Total vendors</p>
              <p className="text-2xl font-semibold tabular-nums">{uniqueContactIds.length}</p>
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
              <p className="text-2xl font-semibold tabular-nums">
                {formatBoothOrderMoney(totalPaid)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <BoothOrdersTable
        rows={orders}
        scope="event"
        emptyMessage="No orders for this event yet."
        exportFileName="orders.csv"
        onRowClick={(row) => setEditingVendor(boothOrderToParticipatingVendor(row))}
        actions={
          <Button type="button" size="sm" onClick={() => setAddOpen(true)} className="shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            Add vendor
          </Button>
        }
      />

      <AddEventVendorDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        eventId={eventId}
        vendorTypes={vendorTypes}
        booths={booths}
        existingContactIds={uniqueContactIds}
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
