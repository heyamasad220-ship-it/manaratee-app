"use client"

import { DollarSign, Ticket, UserCheck, Users } from "lucide-react"

import { StatCard, StatCardsRow, type StatCardTone } from "@/components/ui/stat-card"
import type { CampaignEventStats } from "@/lib/events/campaign-event-actions"

const TYPE_TONES: StatCardTone[] = ["sky", "teal", "orange", "violet", "rose", "indigo"]

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100)
}

export function CampaignEventKpis({ stats }: { stats: CampaignEventStats }) {
  if (!stats.requiresTicketing && stats.ticketsSold === 0 && stats.types.length === 0) {
    return null
  }

  const summaryCards = [
    {
      key: "sold",
      label: "Tickets sold",
      value: stats.ticketsSold.toLocaleString(),
      hint:
        stats.ticketsCapacity != null
          ? `of ${stats.ticketsCapacity.toLocaleString()}`
          : "Issued seats",
      tone: "blue" as const,
      icon: Ticket,
    },
    ...(stats.ticketsRemaining != null
      ? [
          {
            key: "remaining",
            label: "Remaining",
            value: stats.ticketsRemaining.toLocaleString(),
            hint: "Seats left",
            tone: "amber" as const,
            icon: Users,
          },
        ]
      : []),
    {
      key: "checked-in",
      label: "Checked in",
      value: stats.checkedIn.toLocaleString(),
      hint: "At the door",
      tone: "emerald" as const,
      icon: UserCheck,
    },
    {
      key: "revenue",
      label: "Ticket revenue",
      value: formatMoney(stats.revenueCents, stats.currency),
      hint: "Completed orders",
      tone: "violet" as const,
      icon: DollarSign,
    },
    ...(stats.waitlisted > 0
      ? [
          {
            key: "waitlisted",
            label: "Waitlisted",
            value: stats.waitlisted.toLocaleString(),
            hint: "Waiting for a seat",
            tone: "rose" as const,
            icon: Users,
          },
        ]
      : []),
  ]

  const summaryColumns = Math.min(6, Math.max(2, summaryCards.length)) as
    | 2
    | 3
    | 4
    | 5
    | 6
  const typeColumns = Math.min(6, Math.max(2, stats.types.length)) as 2 | 3 | 4 | 5 | 6

  return (
    <div className="space-y-3">
      <StatCardsRow equal columns={summaryColumns} className="gap-3">
        {summaryCards.map((card) => (
          <StatCard
            key={card.key}
            layout="compact"
            fill
            tone={card.tone}
            icon={card.icon}
            label={card.label}
            value={card.value}
            hint={card.hint}
            valueClassName="text-xl"
          />
        ))}
      </StatCardsRow>

      {stats.types.length > 0 ? (
        <StatCardsRow equal columns={typeColumns} className="gap-3">
          {stats.types.map((type, index) => (
            <StatCard
              key={type.id}
              layout="compact"
              fill
              tone={TYPE_TONES[index % TYPE_TONES.length]}
              icon={Ticket}
              label={type.name}
              value={type.sold.toLocaleString()}
              hint={
                type.capacity != null
                  ? `${type.remaining?.toLocaleString() ?? 0} left · ${formatMoney(type.priceCents, stats.currency)}`
                  : formatMoney(type.priceCents, stats.currency)
              }
              valueClassName="text-xl"
            />
          ))}
        </StatCardsRow>
      ) : null}
    </div>
  )
}
