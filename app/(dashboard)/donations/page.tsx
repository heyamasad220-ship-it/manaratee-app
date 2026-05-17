"use client"

import { useEffect, useMemo, useState } from "react"
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
  Plus,
  Heart,
  CreditCard,
  AlertCircle,
  Wallet,
  ArrowUpRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

type Payment = {
  id: string
  donor_name: string | null
  amount: number
  payment_date: string
  source: string
  status: "Allocated" | "Unallocated" | string
}

type Pledge = {
  id: string
  donor_name: string | null
  amount: number
  collected_amount: number | null
  status: string | null
}

const sourceColors: Record<string, string> = {
  Stripe: "#635BFF",
  Zelle: "#6D1ED4",
  Venmo: "#008CFF",
  PayPal: "#003087",
  Cash: "#10B981",
  Check: "#6B7280",
}

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

function getRangeStart(timeRange: string) {
  const now = new Date()

  if (timeRange === "this-month") {
    return new Date(now.getFullYear(), now.getMonth(), 1)
  }

  if (timeRange === "this-quarter") {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3
    return new Date(now.getFullYear(), quarterStartMonth, 1)
  }

  if (timeRange === "this-year") {
    return new Date(now.getFullYear(), 0, 1)
  }

  return null
}

function formatMonth(dateValue: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(dateValue))
}

export default function DonationsPage() {
  const [timeRange, setTimeRange] = useState("this-year")
  const [payments, setPayments] = useState<Payment[]>([])
  const [pledges, setPledges] = useState<Pledge[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const loadDonationData = async () => {
      setIsLoading(true)
      setErrorMessage(null)

      const supabase = createClient()
      const rangeStart = getRangeStart(timeRange)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setErrorMessage("User not authenticated.")
        setPayments([])
        setPledges([])
        setIsLoading(false)
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("organization_id, role")
        .eq("id", user.id)
        .single()

      if (profileError || !profile?.organization_id) {
        setErrorMessage("Unable to load your organization.")
        setPayments([])
        setPledges([])
        setIsLoading(false)
        return
      }

      if (!["owner", "admin"].includes(profile.role || "")) {
        setErrorMessage("You do not have permission to view donations.")
        setPayments([])
        setPledges([])
        setIsLoading(false)
        return
      }

      const organizationId = profile.organization_id

      let paymentsQuery = supabase
        .from("donation_payments")
        .select("id, donor_name, amount, payment_date, source, status")
        .eq("organization_id", organizationId)
        .order("payment_date", { ascending: false })

      if (rangeStart) {
        paymentsQuery = paymentsQuery.gte("payment_date", rangeStart.toISOString())
      }

      const [paymentsResult, pledgesResult] = await Promise.all([
        paymentsQuery,
        supabase
          .from("donation_pledges")
          .select("id, donor_name, amount, collected_amount, status")
          .eq("organization_id", organizationId)
          .neq("status", "Cancelled"),
      ])

      if (paymentsResult.error || pledgesResult.error) {
        setErrorMessage(
          paymentsResult.error?.message ||
            pledgesResult.error?.message ||
            "Unable to load donation data."
        )
        setPayments([])
        setPledges([])
      } else {
        setPayments(paymentsResult.data || [])
        setPledges(pledgesResult.data || [])
      }

      setIsLoading(false)
    }

    loadDonationData()
  }, [timeRange])

  const totalPledged = useMemo(
    () => pledges.reduce((sum, pledge) => sum + Number(pledge.amount || 0), 0),
    [pledges]
  )

  const totalCollected = useMemo(
    () => payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [payments]
  )

  const outstandingBalance = Math.max(totalPledged - totalCollected, 0)

  const paymentsThisMonth = useMemo(() => {
    const now = new Date()
    return payments
      .filter((payment) => {
        const paymentDate = new Date(payment.payment_date)
        return paymentDate.getMonth() === now.getMonth() && paymentDate.getFullYear() === now.getFullYear()
      })
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  }, [payments])

  const paymentsOverTime = useMemo(() => {
    const monthlyTotals = payments.reduce<Record<string, { month: string; amount: number; count: number }>>(
      (acc, payment) => {
        const month = formatMonth(payment.payment_date)
        if (!acc[month]) {
          acc[month] = { month, amount: 0, count: 0 }
        }
        acc[month].amount += Number(payment.amount || 0)
        acc[month].count += 1
        return acc
      },
      {}
    )

    return Object.values(monthlyTotals).reverse()
  }, [payments])

  const paymentsBySource = useMemo(() => {
    const sourceTotals = payments.reduce<Record<string, number>>((acc, payment) => {
      const source = payment.source || "Other"
      acc[source] = (acc[source] || 0) + Number(payment.amount || 0)
      return acc
    }, {})

    return Object.entries(sourceTotals).map(([name, value]) => ({
      name,
      value,
      color: sourceColors[name] || "#6B7280",
    }))
  }, [payments])

  const recentPayments = payments.slice(0, 5)

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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Dashboard Overview</h2>
              <p className="text-sm text-muted-foreground">
                Track donations, pledges, and payment activity
              </p>
              {errorMessage && <p className="mt-2 text-sm text-red-600">{errorMessage}</p>}
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

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Pledged</p>
                    <p className="text-2xl font-bold text-foreground">{formatCurrency(totalPledged)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      From {pledges.length} active pledges
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
                      {payments.length} transactions
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
                      {totalPledged > 0 ? `${((outstandingBalance / totalPledged) * 100).toFixed(0)}% of pledges unpaid` : "No pledges yet"}
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
                      {payments.filter((payment) => {
                        const paymentDate = new Date(payment.payment_date)
                        const now = new Date()
                        return paymentDate.getMonth() === now.getMonth() && paymentDate.getFullYear() === now.getFullYear()
                      }).length} transactions
                    </div>
                  </div>
                  <div className="rounded-full bg-purple-100 p-3">
                    <Wallet className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Payments Over Time</CardTitle>
                <CardDescription>Monthly payment activity for the selected range</CardDescription>
              </CardHeader>
              <CardContent>
                {paymentsOverTime.length === 0 ? (
                  <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                    {isLoading ? "Loading donation data..." : "No payment data yet. Add payments from the Record Payment page."}
                  </div>
                ) : (
                  <ChartContainer config={chartConfig} className="h-[300px] w-full">
                    <LineChart data={paymentsOverTime} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                      />
                      <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(value as number)} />} />
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
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Breakdown by Source</CardTitle>
                <CardDescription>Payment methods used</CardDescription>
              </CardHeader>
              <CardContent>
                {paymentsBySource.length === 0 ? (
                  <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                    {isLoading ? "Loading..." : "No sources yet"}
                  </div>
                ) : (
                  <>
                    <div className="h-[200px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={paymentsBySource} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
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
                                    <p className="text-sm text-muted-foreground">{formatCurrency(data.value)}</p>
                                  </div>
                                )
                              }
                              return null
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {paymentsBySource.map((source) => (
                        <div key={source.name} className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: source.color }} />
                          <span className="text-xs text-muted-foreground">{source.name}</span>
                          <span className="ml-auto text-xs font-medium">
                            {((source.value / paymentsBySource.reduce((a, b) => a + b.value, 0)) * 100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

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
                  {recentPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        {isLoading ? "Loading payments..." : "No payments yet. Use Record Payment to add one."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentPayments.map((payment) => (
                      <TableRow key={payment.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-medium">
                          {!payment.donor_name ? <span className="text-amber-600">Unknown</span> : payment.donor_name}
                        </TableCell>
                        <TableCell className="font-semibold text-emerald-600">{formatCurrency(payment.amount)}</TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
                              payment.source === "Stripe" && "bg-[#635BFF]/10 text-[#635BFF]",
                              payment.source === "Zelle" && "bg-[#6D1ED4]/10 text-[#6D1ED4]",
                              payment.source === "Venmo" && "bg-[#008CFF]/10 text-[#008CFF]",
                              payment.source === "PayPal" && "bg-[#003087]/10 text-[#003087]",
                              payment.source === "Cash" && "bg-emerald-100 text-emerald-700",
                              payment.source === "Check" && "bg-gray-100 text-gray-700",
                              !sourceColors[payment.source] && "bg-gray-100 text-gray-700"
                            )}
                          >
                            {payment.source || "Other"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
                              payment.status === "Allocated" && "bg-emerald-100 text-emerald-700",
                              payment.status === "Unallocated" && "bg-amber-100 text-amber-700"
                            )}
                          >
                            {payment.status || "Unallocated"}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(payment.payment_date))}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

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