"use client"

import { CalendarClock, DollarSign, Gift, Repeat, Users } from "lucide-react"

import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import {
  computeCampaignDonationKpis,
  formatDonationCurrency,
  type CampaignPaymentRow,
  type CampaignRecurringPlanRow,
} from "@/lib/donations/campaign-analytics"

export function CampaignDonationsKpis({
  payments,
  recurringPlans,
}: {
  payments: CampaignPaymentRow[]
  recurringPlans: CampaignRecurringPlanRow[]
}) {
  const kpis = computeCampaignDonationKpis(payments, recurringPlans)

  return (
    <StatCardsRow equal columns={5} className="gap-3">
      <StatCard
        layout="compact"
        fill
        className="h-full"
        tone="blue"
        icon={DollarSign}
        label="One-Time Total"
        value={formatDonationCurrency(kpis.oneTimeTotal)}
        valueClassName="text-xl"
      />
      <StatCard
        layout="compact"
        fill
        className="h-full"
        tone="violet"
        icon={Repeat}
        label="Recurring Donations"
        value={kpis.recurringCount.toLocaleString()}
        valueClassName="text-xl"
      />
      <StatCard
        layout="compact"
        fill
        className="h-full"
        tone="emerald"
        icon={CalendarClock}
        label="Monthly Recurring"
        value={formatDonationCurrency(kpis.monthlyRecurringAmount)}
        valueClassName="text-xl"
      />
      <StatCard
        layout="compact"
        fill
        className="h-full"
        tone="sky"
        icon={Gift}
        label="One-Time Gifts"
        value={kpis.oneTimeCount.toLocaleString()}
        valueClassName="text-xl"
      />
      <StatCard
        layout="compact"
        fill
        className="h-full"
        tone="amber"
        icon={Users}
        label="Donors"
        value={kpis.donorCount.toLocaleString()}
        valueClassName="text-xl"
      />
    </StatCardsRow>
  )
}
