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
  Target,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatPaymentStatusLabel, normalizePaymentStatus } from "@/lib/donations/donation-status"
import { CampaignProgressBar } from "@/components/donations/campaign-progress-bar"
import {
  DonationMetricCard,
  DonationMetricCardGrid,
} from "@/components/donations/donation-metric-card"
import {
  formatDonationCurrency,
  type CampaignAnalyticsEntry,
} from "@/lib/donations/campaign-analytics"
import {
  getDonationDashboardCampaignsAction,
  getDonationDashboardSummaryAction,
} from "@/lib/donations/donation-dashboard-actions"

type Payment = {
  id: string
  sender_name: string | null
  amount: number
  payment_date: string
  source: string
  status: string
  pledge_id?: string | null
  campaign_id?: string | null
  donor_id?: string | null
  contact_id?: string | null
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
  const [dashboardSummary, setDashboardSummary] = useState({
    totalCollected: 0,
    paymentCount: 0,
    thisMonthCollected: 0,
    totalPledged: 0,
    pledgeCollected: 0,
    outstandingBalance: 0,
    activePledgeCount: 0,
  })
  const [monthlyTotals, setMonthlyTotals] = useState<
    Array<{ monthKey: string; amount: number; paymentCount: number }>
  >([])
  const [sourceTotals, setSourceTotals] = useState<
    Array<{ sourceKey: string; amount: number }>
  >([])
  const [campaignEntries, setCampaignEntries] = useState<CampaignAnalyticsEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const loadDonationData = async () => {
      setIsLoading(true)
      setErrorMessage(null)

      const rangeStart = getRangeStart(timeRange)

      const [summaryResult, campaignsResult] = await Promise.all([
        getDonationDashboardSummaryAction(
          rangeStart ? rangeStart.toISOString() : null
        ),
        getDonationDashboardCampaignsAction(),
      ])

      if (!summaryResult.success) {
        setErrorMessage(summaryResult.error)
        setPayments([])
        setCampaignEntries([])
        setIsLoading(false)
        return
      }

      if (!campaignsResult.success) {
        setErrorMessage(campaignsResult.error)
        setPayments([])
        setCampaignEntries([])
        setIsLoading(false)
        return
      }

      setDashboardSummary(summaryResult.summary)
      setMonthlyTotals(summaryResult.monthlyTotals)
      setSourceTotals(summaryResult.sourceTotals)
      setPayments(campaignsResult.recentPayments as Payment[])
      setCampaignEntries(campaignsResult.campaignEntries)
      setIsLoading(false)
    }

    loadDonationData()
  }, [timeRange])

  const totalPledged = dashboardSummary.totalPledged
  const totalCollected = dashboardSummary.totalCollected
  const outstandingBalance = dashboardSummary.outstandingBalance
  const paymentsThisMonth = dashboardSummary.thisMonthCollected

  const paymentsOverTime = useMemo(() => {
    return [...monthlyTotals]
      .map((row) => ({
        month: row.monthKey,
        amount: row.amount,
        count: row.paymentCount,
      }))
      .reverse()
  }, [monthlyTotals])

  const paymentsBySource = useMemo(() => {
    return sourceTotals.map((row) => ({
      name: row.sourceKey,
      value: row.amount,
      color: sourceColors[row.sourceKey] || sourceColors[row.sourceKey.charAt(0).toUpperCase() + row.sourceKey.slice(1)] || "#6B7280",
    }))
  }, [sourceTotals])

  const recentPayments = payments

  const topCampaigns = useMemo(
    () => [...campaignEntries].sort((a, b) => b.metrics.raised - a.metrics.raised).slice(0, 5),
    [campaignEntries]
  )

  const campaignsWithGoals = useMemo(
    () => campaignEntries.filter((entry) => Number(entry.campaign.goal_amount || 0) > 0),
    [campaignEntries]
  )

  const campaignsGoalAchieved = useMemo(
    () =>
      campaignsWithGoals.filter(
        (entry) => (entry.metrics.progressPercent ?? 0) >= 100
      ).length,
    [campaignsWithGoals]
  )

  const formatCurrency = (value: number) => formatDonationCurrency(value)

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

          <DonationMetricCardGrid colorful>
            <DonationMetricCard
              title="Total Pledged"
              value={formatCurrency(totalPledged)}
              icon={Heart}
              accent="blue"
              description={`From ${dashboardSummary.activePledgeCount} active pledges`}
            />
            <DonationMetricCard
              title="Total Collected"
              value={formatCurrency(totalCollected)}
              icon={DollarSign}
              accent="emerald"
              description={
                <span className="inline-flex items-center">
                  <ArrowUpRight className="mr-1 h-3 w-3" />
                  {payments.length} transactions
                </span>
              }
            />
            <DonationMetricCard
              title="Outstanding Balance"
              value={formatCurrency(outstandingBalance)}
              icon={AlertCircle}
              accent="amber"
              description={
                totalPledged > 0
                  ? `${((outstandingBalance / totalPledged) * 100).toFixed(0)}% of pledges unpaid`
                  : "No pledges yet"
              }
            />
            <DonationMetricCard
              title="Payments This Month"
              value={formatCurrency(paymentsThisMonth)}
              icon={Wallet}
              accent="purple"
              description={
                <span className="inline-flex items-center">
                  <ArrowUpRight className="mr-1 h-3 w-3" />
                  {
                    payments.filter((payment) => {
                      const paymentDate = new Date(payment.payment_date)
                      const now = new Date()
                      return (
                        paymentDate.getMonth() === now.getMonth() &&
                        paymentDate.getFullYear() === now.getFullYear()
                      )
                    }).length
                  }{" "}
                  transactions
                </span>
              }
            />
          </DonationMetricCardGrid>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Top Campaigns
                  </CardTitle>
                  <CardDescription>Ranked by amount raised</CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/donations/campaigns">View All</Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Raised</TableHead>
                      <TableHead>Goal</TableHead>
                      <TableHead>Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topCampaigns.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                          {isLoading ? "Loading campaigns..." : "No campaigns yet"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      topCampaigns.map(({ campaign, metrics }) => (
                        <TableRow key={campaign.id}>
                          <TableCell>
                            <Link
                              href={`/donations/campaigns/${campaign.id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {campaign.name}
                            </Link>
                          </TableCell>
                          <TableCell className="font-medium text-emerald-600">
                            {formatCurrency(metrics.raised)}
                          </TableCell>
                          <TableCell>{formatCurrency(Number(campaign.goal_amount || 0))}</TableCell>
                          <TableCell className="min-w-[120px]">
                            <CampaignProgressBar progressPercent={metrics.progressPercent} />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Campaign Progress</CardTitle>
                  <CardDescription>Active fundraising goals</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {campaignsWithGoals.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No campaign goals configured yet.</p>
                  ) : (
                    campaignsWithGoals.slice(0, 4).map(({ campaign, metrics }) => (
                      <div key={campaign.id}>
                        <div className="mb-1 flex justify-between text-sm">
                          <Link
                            href={`/donations/campaigns/${campaign.id}`}
                            className="font-medium hover:underline"
                          >
                            {campaign.name}
                          </Link>
                          <span>{formatCurrency(metrics.raised)}</span>
                        </div>
                        <CampaignProgressBar progressPercent={metrics.progressPercent} />
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Goal Achievement</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">
                    {campaignsGoalAchieved}
                    <span className="text-base font-normal text-muted-foreground">
                      {" "}
                      / {campaignsWithGoals.length}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Campaigns that reached 100% of goal
                  </p>
                </CardContent>
              </Card>
            </div>
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
                          {!payment.sender_name ? (
                            <span className="text-amber-600">Unknown</span>
                          ) : (
                            payment.sender_name
                          )}
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
                              "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium capitalize",
                              normalizePaymentStatus(payment.status) === "allocated" &&
                                "bg-emerald-100 text-emerald-700",
                              normalizePaymentStatus(payment.status) === "unallocated" &&
                                "bg-amber-100 text-amber-700",
                              normalizePaymentStatus(payment.status) === "pending_review" &&
                                "bg-amber-100 text-amber-700",
                              normalizePaymentStatus(payment.status) === "unresolved" &&
                                "bg-red-100 text-red-700"
                            )}
                          >
                            {formatPaymentStatusLabel(payment.status)}
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

          <DonationMetricCardGrid>
            <Link href="/donations/payments">
              <DonationMetricCard
                title="Payments"
                icon={CreditCard}
                description="View all payments"
                className="h-full transition-colors hover:bg-muted/50"
              />
            </Link>
            <Link href="/donations/pledges">
              <DonationMetricCard
                title="Pledges"
                icon={Heart}
                description="Track commitments"
                className="h-full transition-colors hover:bg-muted/50"
              />
            </Link>
            <Link href="/donations/import">
              <DonationMetricCard
                title="Import"
                icon={TrendingUp}
                description="Upload payment files"
                className="h-full transition-colors hover:bg-muted/50"
              />
            </Link>
            <Link href="/donations/reconcile">
              <DonationMetricCard
                title="Reconcile"
                icon={Users}
                description="Match payments"
                className="h-full transition-colors hover:bg-muted/50"
              />
            </Link>
          </DonationMetricCardGrid>
        </div>
      </div>
    </>
  )
}