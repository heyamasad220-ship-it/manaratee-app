import { DollarSign, Store, Users, Utensils } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { VendorHubReportOverview } from "@/lib/vendor-hub/vendor-hub-reports-queries"

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

export function VendorHubReportsOverviewPanels({
  overview,
  scopeLabel,
}: {
  overview: VendorHubReportOverview
  scopeLabel: string
}) {
  return (
    <div className="flex flex-col gap-6">
      <StatCardsRow equal columns={4}>
        <StatCard
          fill
          layout="header"
          label="Total revenue"
          value={formatMoney(overview.totalRevenue)}
          hint={scopeLabel}
          icon={DollarSign}
          tone="violet"
          className="h-full"
        />
        <StatCard
          fill
          layout="header"
          label="Assigned vendors"
          value={overview.totalVendors}
          hint="With booth assignments"
          icon={Store}
          tone="blue"
          className="h-full"
        />
        <StatCard
          fill
          layout="header"
          label="Food category"
          value={overview.foodVendors}
          hint="Booth types matching food"
          icon={Utensils}
          tone="amber"
          className="h-full"
        />
        <StatCard
          fill
          layout="header"
          label="Est. attendance"
          value={overview.expectedAttendance.toLocaleString()}
          hint="From event expected attendees"
          icon={Users}
          tone="emerald"
          className="h-full"
        />
      </StatCardsRow>

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
                {overview.revenueByCategory.length === 0 ? (
                  <EmptyTableMessage message="No booth payments recorded for this scope." />
                ) : (
                  overview.revenueByCategory.map((row) => (
                    <TableRow key={row.category}>
                      <TableCell className="font-medium">{row.category}</TableCell>
                      <TableCell>{row.vendors}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.revenue)}</TableCell>
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
                {overview.topVendors.length === 0 ? (
                  <EmptyTableMessage message="No vendor payments yet." />
                ) : (
                  overview.topVendors.map((row) => (
                    <TableRow key={`${row.vendorName}-${row.category}`}>
                      <TableCell className="font-medium">{row.vendorName}</TableCell>
                      <TableCell>{row.category}</TableCell>
                      <TableCell className="text-right">{formatMoney(row.feesPaid)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
