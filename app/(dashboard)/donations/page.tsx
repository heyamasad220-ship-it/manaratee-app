"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DollarSign, Plus, AlertCircle, Wallet, ArrowUpRight, Target } from "lucide-react"
import {
  DonationMetricCard,
  DonationMetricCardGrid,
} from "@/components/donations/donation-metric-card"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"
import { getDonationDashboardSummaryAction } from "@/lib/donations/donation-dashboard-actions"

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
  const [dashboardSummary, setDashboardSummary] = useState({
    totalCollected: 0,
    paymentCount: 0,
    thisMonthCollected: 0,
    totalPledged: 0,
    pledgeCollected: 0,
    outstandingBalance: 0,
    activePledgeCount: 0,
    activeCampaignCount: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const loadDonationData = async () => {
      setIsLoading(true)
      setErrorMessage(null)

      const rangeStart = getRangeStart(timeRange)
      const summaryResult = await getDonationDashboardSummaryAction(
        rangeStart ? rangeStart.toISOString() : null
      )

      if (!summaryResult.success) {
        setErrorMessage(summaryResult.error)
        setIsLoading(false)
        return
      }

      setDashboardSummary(summaryResult.summary)
      setIsLoading(false)
    }

    loadDonationData()
  }, [timeRange])

  const totalPledged = dashboardSummary.totalPledged
  const totalCollected = dashboardSummary.totalCollected
  const outstandingBalance = dashboardSummary.outstandingBalance
  const paymentsThisMonth = dashboardSummary.thisMonthCollected

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
              {isLoading ? (
                <p className="mt-2 text-sm text-muted-foreground">Loading dashboard...</p>
              ) : null}
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

          <DonationMetricCardGrid colorful className="lg:grid-cols-4">
            <DonationMetricCard
              title="Active Campaigns"
              value={dashboardSummary.activeCampaignCount}
              icon={Target}
              accent="blue"
              description="Fundraising campaigns in progress"
            />
            <DonationMetricCard
              title="Total Collected"
              value={formatCurrency(totalCollected)}
              icon={DollarSign}
              accent="emerald"
              description={
                <span className="inline-flex items-center">
                  <ArrowUpRight className="mr-1 h-3 w-3" />
                  {dashboardSummary.paymentCount} transactions
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
              description="Current calendar month"
            />
          </DonationMetricCardGrid>
        </div>
      </div>
    </>
  )
}
