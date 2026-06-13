"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, Calendar, TrendingUp } from "lucide-react"
import { getDonorGivingTotalsAction } from "@/lib/donations/receipt-actions"
import type { DonorGivingTotals } from "@/lib/donations/receipt-types"
import { GivingStatementActions } from "@/components/donations/giving-statement-actions"

type DonorGivingSummaryProps = {
  donorId: string
  donorName: string
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(amount)
}

export function DonorGivingSummary({ donorId, donorName }: DonorGivingSummaryProps) {
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

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading giving totals...</div>
  }

  if (!totals) return null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 [&>*]:w-fit">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Lifetime Giving
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.lifetimeGiving)}</div>
            <p className="text-xs text-muted-foreground">All actual payments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {totals.currentYear} Giving
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.currentYearGiving)}</div>
            <p className="text-xs text-muted-foreground">Current calendar year</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {totals.previousYear} Giving
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.previousYearGiving)}</div>
            <p className="text-xs text-muted-foreground">Prior calendar year</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Annual Giving Statement</CardTitle>
        </CardHeader>
        <CardContent>
          <GivingStatementActions donorId={donorId} donorName={donorName} />
        </CardContent>
      </Card>
    </div>
  )
}
