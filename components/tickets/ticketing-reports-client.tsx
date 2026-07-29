"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Download,
  TrendingUp,
  Ticket,
  DollarSign,
  Users,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import type {
  TicketingReportRangeKey,
  TicketingReportsData,
} from "@/lib/tickets/ticketing-reports-queries"

const reportViews = [
  {
    value: "days",
    label: "Days",
    description: "Daily ticket sales from completed orders",
  },
  {
    value: "events",
    label: "Events",
    description: "Performance breakdown by event",
  },
  {
    value: "customers",
    label: "Customers",
    description: "Top customers by purchase volume this period",
  },
] as const

type ReportView = (typeof reportViews)[number]["value"]

function formatMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

function formatEventDate(value: string | null) {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "—"
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function periodChangeLabel(value: number | null) {
  if (value == null) return "No prior-period baseline"
  const sign = value > 0 ? "+" : ""
  return `${sign}${value}% from last period`
}

function EmptyTableRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className="py-8 text-center text-muted-foreground"
      >
        {label}
      </TableCell>
    </TableRow>
  )
}

function downloadCsv(filename: string, rows: string[][]) {
  const content = rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? "")
          if (/[",\n]/.test(value)) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value
        })
        .join(",")
    )
    .join("\n")

  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function TicketingReportsClient({
  data,
  rangeKey,
}: {
  data: TicketingReportsData
  rangeKey: TicketingReportRangeKey
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [view, setView] = useState<ReportView>("events")
  const currency = data.overview.currency || "USD"
  const activeView =
    reportViews.find((item) => item.value === view) || reportViews[1]

  const salesRows = useMemo(
    () =>
      data.salesByDay.filter(
        (row) =>
          row.orders > 0 || row.grossSalesCents > 0 || row.refundsCents > 0
      ),
    [data.salesByDay]
  )

  const exportRows = useMemo(() => {
    if (view === "days") {
      return [
        ["Date", "Orders", "Tickets", "Gross Sales", "Refunds", "Net Sales"],
        ...salesRows.map((row) => [
          row.dateLabel,
          String(row.orders),
          String(row.tickets),
          formatMoney(row.grossSalesCents, currency),
          formatMoney(row.refundsCents, currency),
          formatMoney(row.netSalesCents, currency),
        ]),
      ]
    }

    if (view === "customers") {
      return [
        ["Customer", "Email", "Orders", "Tickets", "Total Spent"],
        ...data.customers.map((row) => [
          row.name,
          row.email,
          String(row.orders),
          String(row.tickets),
          formatMoney(row.totalSpentCents, row.currency),
        ]),
      ]
    }

    return [
      ["Event", "Date", "Capacity", "Sold", "Fill Rate", "Revenue"],
      ...data.events.map((row) => [
        row.eventName,
        formatEventDate(row.eventStartAt),
        row.capacity == null ? "Unlimited" : String(row.capacity),
        String(row.ticketsSold),
        row.fillRatePct == null ? "—" : `${row.fillRatePct}%`,
        formatMoney(row.revenueCents, row.currency),
      ]),
    ]
  }, [currency, data.customers, data.events, salesRows, view])

  function onRangeChange(next: string) {
    startTransition(() => {
      router.push(`/event-management/ticketing/reports?range=${next}`)
    })
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Select value={view} onValueChange={(next) => setView(next as ReportView)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="View" />
          </SelectTrigger>
          <SelectContent>
            {reportViews.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={rangeKey}
          onValueChange={onRangeChange}
          disabled={isPending}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="1y">Last year</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={() =>
            downloadCsv(
              `ticketing-reports-${view}-${rangeKey}.csv`,
              exportRows
            )
          }
        >
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      <StatCardsRow equal columns={4}>
        <StatCard
          fill
          layout="header"
          tone="emerald"
          label="Total Sales"
          value={formatMoney(data.overview.totalSalesCents, currency)}
          icon={DollarSign}
          hint={periodChangeLabel(data.overview.totalSalesChangePct)}
        />
        <StatCard
          fill
          layout="header"
          tone="blue"
          label="Tickets Sold"
          value={data.overview.ticketsSold.toLocaleString()}
          icon={Ticket}
          hint={periodChangeLabel(data.overview.ticketsSoldChangePct)}
        />
        <StatCard
          fill
          layout="header"
          tone="violet"
          label="Avg. Order Value"
          value={formatMoney(data.overview.avgOrderValueCents, currency)}
          icon={TrendingUp}
          hint={periodChangeLabel(data.overview.avgOrderValueChangePct)}
        />
        <StatCard
          fill
          layout="header"
          tone="amber"
          label="Unique Customers"
          value={data.overview.uniqueCustomers.toLocaleString()}
          icon={Users}
          hint={periodChangeLabel(data.overview.uniqueCustomersChangePct)}
        />
      </StatCardsRow>

      <Card>
        <CardHeader>
          <CardTitle>
            {view === "days"
              ? "Sales by day"
              : view === "customers"
                ? "Customer report"
                : "Events report"}
          </CardTitle>
          <CardDescription>{activeView.description}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {view === "days" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Tickets</TableHead>
                  <TableHead className="text-right">Gross Sales</TableHead>
                  <TableHead className="text-right">Refunds</TableHead>
                  <TableHead className="text-right">Net Sales</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesRows.length === 0 ? (
                  <EmptyTableRow
                    colSpan={6}
                    label="No ticket sales in this period."
                  />
                ) : (
                  salesRows.map((row) => (
                    <TableRow key={row.dateKey}>
                      <TableCell>{row.dateLabel}</TableCell>
                      <TableCell>{row.orders}</TableCell>
                      <TableCell>{row.tickets}</TableCell>
                      <TableCell className="text-right">
                        {formatMoney(row.grossSalesCents, currency)}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {row.refundsCents > 0
                          ? `-${formatMoney(row.refundsCents, currency)}`
                          : formatMoney(0, currency)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMoney(row.netSalesCents, currency)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : null}

          {view === "events" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Sold</TableHead>
                  <TableHead>Fill Rate</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.events.length === 0 ? (
                  <EmptyTableRow
                    colSpan={6}
                    label="No ticketed event sales in this period."
                  />
                ) : (
                  data.events.map((row) => (
                    <TableRow key={row.eventId}>
                      <TableCell className="font-medium">
                        {row.eventName}
                      </TableCell>
                      <TableCell>
                        {formatEventDate(row.eventStartAt)}
                      </TableCell>
                      <TableCell>
                        {row.capacity == null
                          ? "Unlimited"
                          : row.capacity.toLocaleString()}
                      </TableCell>
                      <TableCell>{row.ticketsSold.toLocaleString()}</TableCell>
                      <TableCell>
                        {row.fillRatePct == null ? "—" : `${row.fillRatePct}%`}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(row.revenueCents, row.currency)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : null}

          {view === "customers" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Tickets</TableHead>
                  <TableHead className="text-right">Total Spent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.customers.length === 0 ? (
                  <EmptyTableRow
                    colSpan={5}
                    label="No customers with ticket purchases in this period."
                  />
                ) : (
                  data.customers.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>{row.email}</TableCell>
                      <TableCell>{row.orders}</TableCell>
                      <TableCell>{row.tickets}</TableCell>
                      <TableCell className="text-right">
                        {formatMoney(row.totalSpentCents, row.currency)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
