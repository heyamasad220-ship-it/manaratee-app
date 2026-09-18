"use client"

import { DollarSign, HeartHandshake, Ticket, UserCheck, Users } from "lucide-react"

import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import type {
  CampaignEventStats,
  CampaignEventTicketTypeStat,
} from "@/lib/events/campaign-event-actions"

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100)
}

function TypeBreakdown({
  types,
  valueFor,
}: {
  types: CampaignEventTicketTypeStat[]
  valueFor: (type: CampaignEventTicketTypeStat) => string
}) {
  if (types.length === 0) return null

  return (
    <ul className="mt-3 space-y-1 border-t border-black/10 pt-2">
      {types.map((type) => (
        <li key={type.id} className="flex items-baseline justify-between gap-2 text-xs">
          <span className="min-w-0 truncate" title={type.name}>
            {type.name}
          </span>
          <span className="shrink-0 tabular-nums font-medium">{valueFor(type)}</span>
        </li>
      ))}
    </ul>
  )
}

export function CampaignEventKpis({ stats }: { stats: CampaignEventStats }) {
  if (!stats.requiresTicketing && stats.ticketsSold === 0 && stats.types.length === 0) {
    return null
  }

  const typeList = stats.types
  const summaryCards = [
    {
      key: "sold",
      label: "Tickets sold",
      value: stats.ticketsSold.toLocaleString(),
      tone: "blue" as const,
      icon: Ticket,
      footer:
        typeList.length > 0 ? (
          <TypeBreakdown
            types={typeList}
            valueFor={(type) => type.sold.toLocaleString()}
          />
        ) : null,
    },
    ...(stats.ticketsRemaining != null
      ? [
          {
            key: "remaining",
            label: "Remaining",
            value: stats.ticketsRemaining.toLocaleString(),
            tone: "amber" as const,
            icon: Users,
            footer:
              typeList.length > 0 ? (
                <TypeBreakdown
                  types={typeList}
                  valueFor={(type) =>
                    type.remaining == null ? "—" : type.remaining.toLocaleString()
                  }
                />
              ) : null,
          },
        ]
      : []),
    {
      key: "checked-in",
      label: "Checked in",
      value: stats.checkedIn.toLocaleString(),
      tone: "emerald" as const,
      icon: UserCheck,
      footer:
        typeList.length > 0 ? (
          <TypeBreakdown
            types={typeList}
            valueFor={(type) => type.checkedIn.toLocaleString()}
          />
        ) : null,
    },
    {
      key: "revenue",
      label: "Ticket revenue",
      value: formatMoney(stats.revenueCents, stats.currency),
      tone: "violet" as const,
      icon: DollarSign,
      footer: null,
    },
    ...(stats.checkoutDonationCents > 0
      ? [
          {
            key: "ticket-donations",
            label: "Ticket donations",
            value: formatMoney(stats.checkoutDonationCents, stats.currency),
            tone: "rose" as const,
            icon: HeartHandshake,
            footer: null,
          },
        ]
      : []),
    ...(stats.waitlisted > 0
      ? [
          {
            key: "waitlisted",
            label: "Waitlisted",
            value: stats.waitlisted.toLocaleString(),
            tone: "rose" as const,
            icon: Users,
            footer: null,
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

  return (
    <StatCardsRow equal columns={summaryColumns} className="gap-3">
      {summaryCards.map((card) => (
        <StatCard
          key={card.key}
          layout="compact"
          fill
          className="h-full"
          tone={card.tone}
          icon={card.icon}
          label={card.label}
          value={card.value}
          footer={card.footer}
          valueClassName="text-xl"
        />
      ))}
    </StatCardsRow>
  )
}
