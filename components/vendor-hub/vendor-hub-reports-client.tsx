"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Download, DollarSign, Store, Users, Utensils } from "lucide-react"

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
import type { VendorHubReportsPayload } from "@/lib/vendor-hub/vendor-hub-reports-queries"
import { cn } from "@/lib/utils"

const reportsTabs = ["Overview", "Vendor Sales", "Booth Performance"] as const
type ReportsTab = (typeof reportsTabs)[number]

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
}: {
  initialData: VendorHubReportsPayload
  initialEventId: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<ReportsTab>("Overview")
  const [eventFilter, setEventFilter] = useState(initialEventId || "all")

  const data = initialData
  const hasEvents = data.events.length > 0

  const selectedLabel = useMemo(() => {
    if (eventFilter === "all") return "All events"
    return data.events.find((event) => event.id === eventFilter)?.name || "Selected event"
  }, [data.events, eventFilter])

  function onEventChange(next: string) {
    setEventFilter(next)
    const params = new URLSearchParams(searchParams.toString())
    if (next === "all") {
      params.delete("eventId")
    } else {
      params.set("eventId", next)
    }
    startTransition(() => {
      router.replace(`?${params.toString()}`)
    })
  }

  function exportCsv() {
    const rows =
      activeTab === "Vendor Sales"
        ? [
            ["Vendor", "Category", "Booth Type", "Status", "Booth Fee", "Paid"],
            ...data.vendorSales.map((row) => [
              row.vendorName,
              row.category,
              row.boothType,
              row.status,
              String(row.boothFee),
              String(row.paid),
            ]),
          ]
        : activeTab === "Booth Performance"
          ? [
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
          : [
              ["Metric", "Value"],
              ["Scope", selectedLabel],
              ["Total Revenue", String(data.overview.totalRevenue)],
              ["Total Vendors", String(data.overview.totalVendors)],
              ["Food category vendors", String(data.overview.foodVendors)],
              ["Expected attendance", String(data.overview.expectedAttendance)],
            ]

    const csv = rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `vendor-hub-${activeTab.toLowerCase().replace(/\s+/g, "-")}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-0 border-b border-border">
          {reportsTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "relative px-4 py-2.5 text-sm font-medium transition-colors",
                activeTab === tab
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
              {activeTab === tab ? (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
              ) : null}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Select value={eventFilter} onValueChange={onEventChange} disabled={isPending}>
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
          <Button type="button" variant="outline" onClick={exportCsv} disabled={!hasEvents}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {!hasEvents ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No bazaar events yet. Create an event and record booth assignments or payments to see
            reports here.
          </CardContent>
        </Card>
      ) : null}

      {hasEvents && activeTab === "Overview" ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap gap-4 [&>*]:w-fit">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Revenue
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatMoney(data.overview.totalRevenue)}
                </div>
                <p className="text-xs text-muted-foreground">{selectedLabel}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Vendors
                </CardTitle>
                <Store className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.overview.totalVendors}</div>
                <p className="text-xs text-muted-foreground">With booth assignments</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Food category
                </CardTitle>
                <Utensils className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.overview.foodVendors}</div>
                <p className="text-xs text-muted-foreground">Booth types matching food</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Est. Attendance
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.overview.expectedAttendance.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">From event expected attendees</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Category</CardTitle>
                <CardDescription>Booth fees collected by booth type</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Vendors</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.overview.revenueByCategory.length === 0 ? (
                      <EmptyTableMessage message="No booth payments recorded for this scope." />
                    ) : (
                      data.overview.revenueByCategory.map((row) => (
                        <TableRow key={row.category}>
                          <TableCell className="font-medium">{row.category}</TableCell>
                          <TableCell>{row.vendors}</TableCell>
                          <TableCell className="text-right">
                            {formatMoney(row.revenue)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Performing Vendors</CardTitle>
                <CardDescription>Highest booth fees paid</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Fees Paid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.overview.topVendors.length === 0 ? (
                      <EmptyTableMessage message="No vendor payments yet." />
                    ) : (
                      data.overview.topVendors.map((row) => (
                        <TableRow key={`${row.vendorName}-${row.category}`}>
                          <TableCell className="font-medium">{row.vendorName}</TableCell>
                          <TableCell>{row.category}</TableCell>
                          <TableCell className="text-right">
                            {formatMoney(row.feesPaid)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {hasEvents && activeTab === "Vendor Sales" ? (
        <Card>
          <CardHeader>
            <CardTitle>Vendor Sales Report</CardTitle>
            <CardDescription>
              Booth assignments with fees and payments for {selectedLabel.toLowerCase()}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Booth Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Booth Fee</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.vendorSales.length === 0 ? (
                  <EmptyTableMessage message="No booth assignments for this scope." />
                ) : (
                  data.vendorSales.map((row, index) => (
                    <TableRow key={`${row.vendorName}-${row.boothType}-${index}`}>
                      <TableCell className="font-medium">{row.vendorName}</TableCell>
                      <TableCell>{row.category}</TableCell>
                      <TableCell>{row.boothType}</TableCell>
                      <TableCell className="capitalize">{row.status.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.boothFee)}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.paid)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {hasEvents && activeTab === "Booth Performance" ? (
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
