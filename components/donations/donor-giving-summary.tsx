"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, Calendar, TrendingUp } from "lucide-react"
import {
  DonationMetricCard,
  DonationMetricCardGrid,
} from "@/components/donations/donation-metric-card"
import { getDonorGivingTotalsAction } from "@/lib/donations/receipt-actions"
import type { DonorGivingTotals } from "@/lib/donations/receipt-types"
import { GivingStatementActions } from "@/components/donations/giving-statement-actions"

type DonorGivingSummaryProps = {
  donorId: string
  donorName: string
  statementOnly?: boolean
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(amount)
}

export function DonorGivingSummary({
  donorId,
  donorName,
  statementOnly = false,
}: DonorGivingSummaryProps) {
  const [totals, setTotals] = useState<DonorGivingTotals | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const result = await getDonorGivingTotalsAction(donorId)
      if (result.success) setTotals(result.totals)
      setLoading(false)
    }
    load()
  }, [donorId])

  if (statementOnly) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Giving Statements</CardTitle>
        </CardHeader>
        <CardContent>
          <GivingStatementActions donorId={donorId} donorName={donorName} />
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading giving totals...</div>
  }

  if (!totals) return null

  return (
    <div className="space-y-4">
      <DonationMetricCardGrid>
        <DonationMetricCard
          title="Lifetime Giving"
          value={formatCurrency(totals.lifetimeGiving)}
          icon={DollarSign}
          description="All actual payments"
        />
        <DonationMetricCard
          title={`${totals.currentYear} Giving`}
          value={formatCurrency(totals.currentYearGiving)}
          icon={Calendar}
          description="Current calendar year"
        />
        <DonationMetricCard
          title={`${totals.previousYear} Giving`}
          value={formatCurrency(totals.previousYearGiving)}
          icon={TrendingUp}
          description="Prior calendar year"
        />
      </DonationMetricCardGrid>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Giving Statements</CardTitle>
        </CardHeader>
        <CardContent>
          <GivingStatementActions donorId={donorId} donorName={donorName} />
        </CardContent>
      </Card>
    </div>
  )
}
