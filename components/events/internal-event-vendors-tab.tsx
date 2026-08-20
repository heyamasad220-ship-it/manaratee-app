"use client"

import Link from "next/link"
import { useMemo, useTransition } from "react"
import { ExternalLink, Loader2, Store, Truck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { updateServiceParticipationStatus } from "@/lib/service-participations/service-participation-actions"
import {
  summarizeVendorRequirements,
  parseServiceRequirements,
} from "@/lib/events/event-service-requirements"
import type { InternalEventWithRelations } from "@/lib/events/internal-event-types"
import type { ServiceParticipationWithContact } from "@/lib/service-participations/service-participation-types"
import {
  SERVICE_PARTICIPATION_STATUS_LABELS,
} from "@/lib/service-participations/service-participation-types"
import type { VendorHubLinkForInternalEvent } from "@/lib/vendor-hub/vendor-hub-internal-event-queries"

type InternalEventVendorsTabProps = {
  event: InternalEventWithRelations
  participations: ServiceParticipationWithContact[]
  canManage: boolean
  vendorHubLink?: VendorHubLinkForInternalEvent | null
}

function VendorParticipationTable({
  rows,
  canManage,
  emptyMessage,
}: {
  rows: ServiceParticipationWithContact[]
  canManage: boolean
  emptyMessage: string
}) {
  const [isPending, startTransition] = useTransition()

  function updateStatus(
    participationId: string,
    status: "confirmed" | "declined" | "cancelled"
  ) {
    startTransition(async () => {
      await updateServiceParticipationStatus({ participationId, status })
    })
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vendor</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead>Status</TableHead>
            {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <div>
                  <p className="font-medium">{row.contact_name}</p>
                  {row.contact_email ? (
                    <p className="text-xs text-muted-foreground">{row.contact_email}</p>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {row.notes || "—"}
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {SERVICE_PARTICIPATION_STATUS_LABELS[row.status]}
                </Badge>
              </TableCell>
              {canManage ? (
                <TableCell className="text-right">
                  {row.status === "pending" ? (
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        disabled={isPending}
                        onClick={() => updateStatus(row.id, "confirmed")}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                        onClick={() => updateStatus(row.id, "declined")}
                      >
                        Decline
                      </Button>
                    </div>
                  ) : isPending ? (
                    <Loader2 className="ml-auto h-4 w-4 animate-spin" />
                  ) : null}
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function InternalEventVendorsTab({
  event,
  participations,
  canManage,
  vendorHubLink = null,
}: InternalEventVendorsTabProps) {
  const serviceConfig = parseServiceRequirements(event.service_requirements)
  const vendorSlots = summarizeVendorRequirements(serviceConfig.vendors)
  const totalSlotCapacity = (serviceConfig.vendors?.slots || []).reduce(
    (sum, slot) => sum + (slot.quantity || 0),
    0
  )
  const legacyCapacity = serviceConfig.vendors?.maxVendors ?? null
  const boothCapacity =
    totalSlotCapacity > 0 ? totalSlotCapacity : legacyCapacity

  const summary = useMemo(() => {
    const active = participations.filter((row) => row.status !== "cancelled")
    const pending = active.filter((row) => row.status === "pending")
    const approved = active.filter((row) => row.status === "confirmed")
    const declined = active.filter((row) => row.status === "declined")

    return {
      applications: active.length,
      pending: pending.length,
      approved: approved.length,
      declined: declined.length,
      boothsFilled: approved.length,
      boothsTotal: boothCapacity,
    }
  }, [participations, boothCapacity])

  const pendingRows = participations.filter((row) => row.status === "pending")
  const approvedRows = participations.filter((row) => row.status === "confirmed")
  const declinedRows = participations.filter((row) => row.status === "declined")

  return (
    <div className="space-y-6">
      {vendorHubLink ? (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="text-base">Vendor Hub bazaar</CardTitle>
              <p className="text-sm text-muted-foreground">
                This event is linked to <strong>{vendorHubLink.name}</strong>
                {vendorHubLink.totalBooths != null
                  ? ` (${vendorHubLink.totalBooths} booths configured)`
                  : ""}
                . Manage booth assignments and payments in Vendor Hub.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={vendorHubLink.href}>
                  Open event
                  <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={vendorHubLink.boothsHref}>
                  Booths
                  <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Applications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{summary.applications}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{summary.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Approved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{summary.approved}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Booth slots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {summary.boothsTotal != null
                ? `${summary.boothsFilled}/${summary.boothsTotal}`
                : summary.boothsFilled}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="applications" className="space-y-4">
        <TabsList>
          <TabsTrigger value="applications">
            Applications ({summary.pending})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved ({summary.approved})
          </TabsTrigger>
          <TabsTrigger value="booths">Booth slots</TabsTrigger>
        </TabsList>

        <TabsContent value="applications" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Truck className="h-4 w-4" />
                Pending applications
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Review vendor sign-ups before assigning booth participation.
              </p>
            </CardHeader>
            <CardContent>
              <VendorParticipationTable
                rows={pendingRows}
                canManage={canManage}
                emptyMessage="No pending vendor applications."
              />
            </CardContent>
          </Card>
          {declinedRows.length > 0 ? (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-base">Declined</CardTitle>
              </CardHeader>
              <CardContent>
                <VendorParticipationTable
                  rows={declinedRows}
                  canManage={false}
                  emptyMessage="No declined applications."
                />
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="approved" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Store className="h-4 w-4" />
                Approved vendors
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Confirmed vendors for this event. Booth numbers and payments are
                managed in Vendor Hub for bazaar-style events.
              </p>
            </CardHeader>
            <CardContent>
              <VendorParticipationTable
                rows={approvedRows}
                canManage={canManage}
                emptyMessage="No approved vendors yet."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="booths" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Booth slots</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configured vendor types and capacity for this event. Assign booth
                numbers in Vendor Hub when this event is linked to a bazaar.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {vendorSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No booth slots configured. Update vendor settings to define types
                  and quantities.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {vendorSlots.map((label) => (
                    <li
                      key={label}
                      className="flex items-center justify-between rounded-md border px-3 py-2"
                    >
                      <span>{label}</span>
                      <Badge variant="secondary">
                        {summary.approved} approved
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
              {serviceConfig.vendors?.applicationDeadline ? (
                <p className="text-sm text-muted-foreground">
                  Application deadline:{" "}
                  {new Date(
                    serviceConfig.vendors.applicationDeadline
                  ).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
