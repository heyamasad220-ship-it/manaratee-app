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

  const recentPayments = payments

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
                <Link href="/donations/payments/one-time">
                  <Plus className="mr-2 h-4 w-4" />
                  Record Payment
                </Link>
              </Button>
            </div>
          </div>

          <DonationMetricCardGrid colorful className="lg:grid-cols-5">
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
            <DonationMetricCard
              title="Goal Achievement"
              value={`${campaignsGoalAchieved} / ${campaignsWithGoals.length}`}
              icon={Target}
              accent="violet"
              description="Campaigns that reached 100% of goal"
            />
          </DonationMetricCardGrid>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Payments</CardTitle>
                <CardDescription>Latest payment transactions</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/donations/payments/one-time">View All Payments</Link>
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
            <Link href="/donations/payments/one-time">
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
            <Link href="/donations/payments/import">
              <DonationMetricCard
                title="Import"
                icon={TrendingUp}
                description="Upload payment files"
                className="h-full transition-colors hover:bg-muted/50"
              />
            </Link>
            <Link href="/donations/payments/match">
              <DonationMetricCard
                title="Match Payments"
                icon={Users}
                description="Match payments to donors"
                className="h-full transition-colors hover:bg-muted/50"
              />
            </Link>
          </DonationMetricCardGrid>
        </div>
      </div>
    </>
  )
}