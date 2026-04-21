"use client"

import { useState } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts"
import {
  DollarSign,
  Users,
  TrendingUp,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Heart,
  CreditCard,
  AlertCircle,
  Wallet,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Mock data for charts
const paymentsOverTime = [
  { month: "Jan", amount: 12500, count: 45 },
  { month: "Feb", amount: 15200, count: 52 },
  { month: "Mar", amount: 18900, count: 61 },
  { month: "Apr", amount: 14300, count: 48 },
  { month: "May", amount: 21500, count: 72 },
  { month: "Jun", amount: 19800, count: 65 },
  { month: "Jul", amount: 16400, count: 55 },
  { month: "Aug", amount: 22100, count: 78 },
  { month: "Sep", amount: 25600, count: 85 },
  { month: "Oct", amount: 23400, count: 80 },
  { month: "Nov", amount: 28900, count: 95 },
  { month: "Dec", amount: 32500, count: 110 },
]

const paymentsBySource = [
  { name: "Stripe", value: 85000, color: "#635BFF" },
  { name: "Zelle", value: 45000, color: "#6D1ED4" },
  { name: "Venmo", value: 32000, color: "#008CFF" },
  { name: "PayPal", value: 28000, color: "#003087" },
  { name: "Cash", value: 15000, color: "#10B981" },
  { name: "Check", value: 12000, color: "#6B7280" },
]

const recentPayments = [
  { id: "p-1", donor: "Ahmed Hassan", amount: 5000, date: "Mar 1, 2026", source: "Stripe", status: "Allocated" },
  { id: "p-2", donor: "Fatima Ali", amount: 1200, date: "Feb 28, 2026", source: "Zelle", status: "Allocated" },
  { id: "p-3", donor: "Unknown", amount: 500, date: "Feb 27, 2026", source: "Venmo", status: "Unallocated" },
  { id: "p-4", donor: "Omar Enterprises", amount: 10000, date: "Feb 27, 2026", source: "Check", status: "Allocated" },
  { id: "p-5", donor: "Sarah Ahmed", amount: 500, date: "Feb 26, 2026", source: "Cash", status: "Allocated" },
]

const chartConfig = {
  amount: {
    label: "Amount",
    color: "hsl(var(--primary))",
  },
  count: {
    label: "Transactions",
    color: "hsl(var(--muted-foreground))",
  },
}

export default function DonationsPage() {
  const [timeRange, setTimeRange] = useState("this-year")

  const totalPledged = 175400
  const totalCollected = 128450
  const outstandingBalance = totalPledged - totalCollected
  const paymentsThisMonth = 32500

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  return (
    <>
      <Header title="Donations" />
      <div className="p-6">
        <div className="flex flex-col gap-6">
          {/* Header with actions */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Dashboard Overview</h2>
              <p className="text-sm text-muted-foreground">
                Track donations, pledges, and payment activity
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="this-quarter">This Quarter</SelectItem>
                  <SelectItem value="this-year">This Year</SelectItem>
                  <SelectItem value="all-time">All Time</SelectItem>
                </SelectContent>
              </Select>
              <Button asChild>
                <Link href="/donations/payments">
                  <Plus className="mr-2 h-4 w-4" />
                  Record Payment
                </Link>
              </Button>
            </div>
          </div>

          {/* Stats cards - Primary metrics */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Pledged</p>
                    <p className="text-2xl font-bold text-foreground">{formatCurrency(totalPledged)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      From 24 active pledges
                    </p>
                  </div>
                  <div className="rounded-full bg-blue-100 p-3">
                    <Heart className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-emerald-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Collected</p>
                    <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalCollected)}</p>
                    <div className="mt-1 flex items-center text-xs text-emerald-600">
                      <ArrowUpRight className="mr-1 h-3 w-3" />
                      +12.5% from last year
                    </div>
                  </div>
                  <div className="rounded-full bg-emerald-100 p-3">
                    <DollarSign className="h-5 w-5 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Outstanding Balance</p>
                    <p className="text-2xl font-bold text-amber-600">{formatCurrency(outstandingBalance)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {((outstandingBalance / totalPledged) * 100).toFixed(0)}% of pledges unpaid
                    </p>
                  </div>
                  <div className="rounded-full bg-amber-100 p-3">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Payments This Month</p>
                    <p className="text-2xl font-bold text-foreground">{formatCurrency(paymentsThisMonth)}</p>
                    <div className="mt-1 flex items-center text-xs text-emerald-600">
                      <ArrowUpRight className="mr-1 h-3 w-3" />
                      110 transactions
                    </div>
                  </div>
                  <div className="rounded-full bg-purple-100 p-3">
                    <Wallet className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Payments Over Time - Line Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Payments Over Time</CardTitle>
                <CardDescription>Monthly payment activity for the current year</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <LineChart data={paymentsOverTime} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    />
                    <ChartTooltip 
                      content={<ChartTooltipContent formatter={(value) => formatCurrency(value as number)} />} 
                    />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, strokeWidth: 2 }}
                    />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Breakdown by Source - Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Breakdown by Source</CardTitle>
                <CardDescription>Payment methods used</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentsBySource}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {paymentsBySource.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload
                            return (
                              <div className="rounded-lg border bg-background p-2 shadow-sm">
                                <p className="font-medium">{data.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {formatCurrency(data.value)}
                                </p>
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Legend */}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {paymentsBySource.map((source) => (
                    <div key={source.name} className="flex items-center gap-2">
                      <div 
                        className="h-3 w-3 rounded-full" 
                        style={{ backgroundColor: source.color }}
                      />
                      <span className="text-xs text-muted-foreground">{source.name}</span>
                      <span className="ml-auto text-xs font-medium">
                        {((source.value / paymentsBySource.reduce((a, b) => a + b.value, 0)) * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Payments Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Payments</CardTitle>
                <CardDescription>Latest payment transactions</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/donations/payments">View All Payments</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Donor</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPayments.map((payment) => (
                    <TableRow key={payment.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium">
                        {payment.donor === "Unknown" ? (
                          <span className="text-amber-600">{payment.donor}</span>
                        ) : (
                          payment.donor
                        )}
                      </TableCell>
                      <TableCell className="font-semibold text-emerald-600">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
                          payment.source === "Stripe" && "bg-[#635BFF]/10 text-[#635BFF]",
                          payment.source === "Zelle" && "bg-[#6D1ED4]/10 text-[#6D1ED4]",
                          payment.source === "Venmo" && "bg-[#008CFF]/10 text-[#008CFF]",
                          payment.source === "PayPal" && "bg-[#003087]/10 text-[#003087]",
                          payment.source === "Cash" && "bg-emerald-100 text-emerald-700",
                          payment.source === "Check" && "bg-gray-100 text-gray-700",
                        )}>
                          {payment.source}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
                          payment.status === "Allocated" && "bg-emerald-100 text-emerald-700",
                          payment.status === "Unallocated" && "bg-amber-100 text-amber-700",
                        )}>
                          {payment.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{payment.date}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/donations/payments">
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center gap-4 pt-6">
                  <div className="rounded-full bg-emerald-100 p-3">
                    <CreditCard className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Payments</p>
                    <p className="text-sm text-muted-foreground">View all payments</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/donations/pledges">
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center gap-4 pt-6">
                  <div className="rounded-full bg-amber-100 p-3">
                    <Heart className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Pledges</p>
                    <p className="text-sm text-muted-foreground">Track commitments</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/donations/import">
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center gap-4 pt-6">
                  <div className="rounded-full bg-blue-100 p-3">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Import</p>
                    <p className="text-sm text-muted-foreground">Upload payment files</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/donations/reconcile">
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center gap-4 pt-6">
                  <div className="rounded-full bg-purple-100 p-3">
                    <Users className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Reconcile</p>
                    <p className="text-sm text-muted-foreground">Match payments</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
