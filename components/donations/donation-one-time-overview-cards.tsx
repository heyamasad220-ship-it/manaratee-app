"use client"

import { useEffect, useState } from "react"
import { Download, DollarSign, TrendingUp, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DonationMetricCard,
  DonationMetricCardGrid,
} from "@/components/donations/donation-metric-card"
import { getDonationReportsOverviewAction } from "@/lib/donations/donation-reports-actions"
import { clearSelectedOrganizationIdCache } from "@/lib/current-organization"

export function DonationOneTimeOverviewCards() {
  const [dateRange, setDateRange] = useState("30d")
  const [overview, setOverview] = useState({
    totalDonations: 0,
    paymentCount: 0,
    donorCount: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadOverview() {
      clearSelectedOrganizationIdCache()
      setLoading(true)

      const overviewResult = await getDonationReportsOverviewAction()
      if (overviewResult.success) {
        setOverview({
          totalDonations: overviewResult.overview.totalDonations,
          paymentCount: overviewResult.overview.paymentCount,
          donorCount: overviewResult.overview.donorCount,
        })
      }

      setLoading(false)
    }

    loadOverview()
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end gap-3">
        <Select value={dateRange} onValueChange={setDateRange}>
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

        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading overview...</p>
      ) : (
        <DonationMetricCardGrid colorful columns={3}>
          <DonationMetricCard
            title="Total Donations"
            value={`$${overview.totalDonations.toLocaleString()}`}
            icon={DollarSign}
            accent="blue"
          />
          <DonationMetricCard
            title="Active Donors"
            value={overview.donorCount}
            icon={Users}
            accent="emerald"
          />
          <DonationMetricCard
            title="Total Payments"
            value={overview.paymentCount}
            icon={TrendingUp}
            accent="purple"
          />
        </DonationMetricCardGrid>
      )}
    </div>
  )
}
