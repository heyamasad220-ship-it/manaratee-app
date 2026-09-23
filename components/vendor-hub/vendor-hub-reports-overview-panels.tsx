import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { VENDOR_HUB_ROUTES, vendorHubReportsPath } from "@/lib/vendor-hub/vendor-hub-routes"
import {
  formatCalendarDate,
  visibleBoothTypes,
  type OverviewRecentOrder,
} from "@/lib/vendor-hub/vendor-hub-overview"
import type { VendorHubBoothPerformanceRow } from "@/lib/vendor-hub/vendor-hub-reports-queries"

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount || 0)
}

function EmptyTableMessage({
  colSpan,
  message,
}: {
  colSpan: number
  message: string
}) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-8 text-center text-sm text-muted-foreground">
        {message}
      </TableCell>
    </TableRow>
  )
}

export function VendorHubReportsOverviewPanels({
  currentEventId,
  currentEventName,
  boothPerformance,
  recentOrders,
  viewAllOrdersHref: viewAllOrdersHrefOverride,
}: {
  currentEventId: string | null
  currentEventName: string | null
  boothPerformance: VendorHubBoothPerformanceRow[]
  recentOrders: OverviewRecentOrder[]
  viewAllOrdersHref?: string
}) {
  const boothRows = visibleBoothTypes(boothPerformance)
  const viewAllOrdersHref =
    viewAllOrdersHrefOverride ??
    (currentEventId
      ? vendorHubReportsPath({ tab: "vendor-sales", eventId: currentEventId })
      : VENDOR_HUB_ROUTES.reports)

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {currentEventName ? (
        <Card>
          <CardHeader>
            <CardTitle>Booths by type</CardTitle>
            <CardDescription>Reserved vs open for {currentEventName}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Reserved</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {boothRows.length === 0 ? (
                  <EmptyTableMessage
                    colSpan={4}
                    message="No booth layout for this bazaar yet."
                  />
                ) : (
                  boothRows.map((row) => (
                    <TableRow key={row.boothType}>
                      <TableCell className="font-medium">{row.boothType}</TableCell>
                      <TableCell className="text-right">{row.allocated}</TableCell>
                      <TableCell className="text-right">{row.available}</TableCell>
                      <TableCell className="text-right">{row.total}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <Card className={currentEventName ? undefined : "lg:col-span-2"}>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Recent orders</CardTitle>
            <CardDescription>
              {currentEventName
                ? `Latest booth purchases for ${currentEventName}`
                : "Latest booth purchases"}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" className="h-7 shrink-0 px-2 text-xs" asChild>
            <Link href={viewAllOrdersHref}>View all orders</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Booth</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentOrders.length === 0 ? (
                <EmptyTableMessage colSpan={4} message="No booth orders yet." />
              ) : (
                recentOrders.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {row.contactId ? (
                        <Link
                          href={VENDOR_HUB_ROUTES.network.vendor(row.contactId)}
                          className="text-primary hover:underline"
                        >
                          {row.vendorName}
                        </Link>
                      ) : (
                        row.vendorName
                      )}
                    </TableCell>
                    <TableCell>{row.boothLabel}</TableCell>
                    <TableCell className="text-right">{formatMoney(row.amountPaid)}</TableCell>
                    <TableCell>{formatCalendarDate(row.paidAt) || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
