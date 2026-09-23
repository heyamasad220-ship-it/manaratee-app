"use client"

import { useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Download } from "lucide-react"

import { BoothOrdersTable } from "@/components/vendor-hub/booth-orders-table"
import { ParticipationHistoryClient } from "@/components/vendor-hub/network/participation-history-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { BoothOrderRow } from "@/lib/vendor-hub/booth-orders"
import type { ParticipationHistoryRow } from "@/lib/vendor-hub/participation-history-queries"
import type { VendorHubReportsPayload } from "@/lib/vendor-hub/vendor-hub-reports-queries"
import type { VendorHubReportsTabId } from "@/lib/vendor-hub/vendor-hub-routes"
import { cn } from "@/lib/utils"

const reportsTabs: Array<{ id: VendorHubReportsTabId; label: string }> = [
  { id: "vendor-sales", label: "Orders" },
  { id: "booth-performance", label: "Booth Performance" },
  { id: "history", label: "Participation History" },
]

function parseReportsTab(value: string | null): VendorHubReportsTabId {
  if (value === "booth-performance" || value === "history" || value === "vendor-sales") {
    return value
  }
  return "vendor-sales"
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount || 0)
}

function EmptyTableMessage({ message }: { message: string }) {
  return (
    <TableRow>
      <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
        {message}
      </TableCell>
    </TableRow>
  )
}

export function VendorHubReportsClient({
  initialData,
  initialEventId,
  historyRows,
  contactIdFilter,
  boothOrders,
}: {
  initialData: VendorHubReportsPayload
  initialEventId: string
  historyRows: ParticipationHistoryRow[]
  contactIdFilter?: string | null
  boothOrders: BoothOrderRow[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const activeTab = parseReportsTab(searchParams.get("tab"))
  const eventFilter = initialEventId || "all"

  const data = initialData
  const hasEvents = data.events.length > 0
  const showEventFilter = activeTab !== "history"
  const selectedEventName =
    eventFilter === "all"
      ? null
      : data.events.find((event) => event.id === eventFilter)?.name || "this bazaar"

  function replaceParams(next: { tab?: VendorHubReportsTabId; eventId?: string }) {
    const params = new URLSearchParams(searchParams.toString())
    const tab = next.tab ?? activeTab
    const eventId = next.eventId ?? eventFilter
    params.set("tab", tab)
    if (eventId === "all") {
      params.delete("eventId")
    } else {
      params.set("eventId", eventId)
    }
    if (tab === "history") {
      if (contactIdFilter) params.set("contact", contactIdFilter)
    } else {
      params.delete("contact")
    }
    startTransition(() => {
      router.replace(`?${params.toString()}`)
    })
  }

  function exportBoothPerformanceCsv() {
    const csvRows = [
      ["Booth Type", "Total", "Allocated", "Available", "Utilization %", "Revenue"],
      ...data.boothPerformance.map((row) => [
        row.boothType,
        String(row.total),
        String(row.allocated),
        String(row.available),
        String(row.utilizationPercent),
        String(row.revenue),
      ]),
    ]
    const csv = csvRows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "vendor-hub-booth-performance.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-0 border-b border-border">
          {reportsTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => replaceParams({ tab: tab.id })}
              className={cn(
                "relative px-4 py-2.5 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {activeTab === tab.id ? (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
              ) : null}
            </button>
          ))}
        </div>
        {showEventFilter ? (
          <div className="flex items-center gap-3">
            <Select
              value={eventFilter}
              onValueChange={(next) => replaceParams({ eventId: next })}
              disabled={isPending}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select event" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                {data.events.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.name}
                    {event.eventDate ? ` (${event.eventDate})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeTab === "booth-performance" ? (
              <Button
                type="button"
                variant="outline"
                onClick={exportBoothPerformanceCsv}
                disabled={!hasEvents}
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {activeTab === "history" ? (
        <ParticipationHistoryClient rows={historyRows} contactIdFilter={contactIdFilter} />
      ) : null}

      {activeTab !== "history" && !hasEvents ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No bazaar events yet. Create an event and record booth assignments or payments to see
            reports here.
          </CardContent>
        </Card>
      ) : null}

      {hasEvents && activeTab === "vendor-sales" ? (
        <BoothOrdersTable
          rows={boothOrders}
          scope="reports"
          emptyMessage="No orders for this scope."
          exportFileName={
            selectedEventName
              ? `${selectedEventName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-orders.csv`
              : "orders.csv"
          }
          linkVendors
        />
      ) : null}

      {hasEvents && activeTab === "booth-performance" ? (
        <Card>
          <CardHeader>
            <CardTitle>Booth Performance Report</CardTitle>
            <CardDescription>Booth inventory utilization and collected fees</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booth Type</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Allocated</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>Utilization</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.boothPerformance.length === 0 ? (
                  <EmptyTableMessage message="No booth inventory for this scope." />
                ) : (
                  data.boothPerformance.map((row) => (
                    <TableRow key={row.boothType}>
                      <TableCell className="font-medium">{row.boothType}</TableCell>
                      <TableCell>{row.total}</TableCell>
                      <TableCell>{row.allocated}</TableCell>
                      <TableCell>{row.available}</TableCell>
                      <TableCell>{row.utilizationPercent}%</TableCell>
                      <TableCell className="text-right">{formatMoney(row.revenue)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
