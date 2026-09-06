"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { CampaignProspectsTab } from "@/components/donations/campaign-prospects-tab"
import { CampaignStrategyTab } from "@/components/donations/campaign-strategy-tab"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"
import type {
  CampaignAskLevelMetrics,
  CampaignAskLevelRow,
} from "@/lib/donations/campaign-ask-level-types"
import type { CampaignProspectAskType } from "@/lib/donations/campaign-prospect-types"
import {
  donationCampaignWorkspaceHref,
  parseCampaignWorkspaceTab,
  parseFundraisingPlanSection,
} from "@/lib/donations/campaign-workspace-paths"
import { cn } from "@/lib/utils"

type CampaignFundraisingPlanHeaderProps = {
  campaignId: string
  askLevelMetrics: CampaignAskLevelMetrics[]
}

export function CampaignFundraisingPlanHeader({
  campaignId,
  askLevelMetrics,
}: CampaignFundraisingPlanHeaderProps) {
  const searchParams = useSearchParams()
  const tab = parseCampaignWorkspaceTab(searchParams.get("tab"))
  const section = parseFundraisingPlanSection(tab, searchParams.get("section"))

  const totals = useMemo(() => {
    return askLevelMetrics.reduce(
      (acc, row) => {
        acc.targetGifts += row.targetCount
        acc.targetValue += row.targetValue
        acc.amountSecured += row.amountSecured
        acc.gap += row.gap
        return acc
      },
      { targetGifts: 0, targetValue: 0, amountSecured: 0, gap: 0 }
    )
  }, [askLevelMetrics])

  const planSections = [
    {
      id: "strategy" as const,
      label: "Strategy",
      href: donationCampaignWorkspaceHref(campaignId, { tab: "plan" }),
    },
    {
      id: "prospects" as const,
      label: "Prospects",
      href: donationCampaignWorkspaceHref(campaignId, {
        tab: "plan",
        section: "prospects",
      }),
    },
  ]

  return (
    <div className="space-y-3">
      <StatCardsRow equal columns={4} className="gap-3">
        <StatCard
          layout="compact"
          fill
          tone="violet"
          label="Targeted gifts"
          value={totals.targetGifts}
          valueClassName="text-xl"
        />
        <StatCard
          layout="compact"
          fill
          tone="sky"
          label="Target value"
          value={formatDonationCurrency(totals.targetValue)}
          valueClassName="text-xl"
        />
        <StatCard
          layout="compact"
          fill
          tone="emerald"
          label="Amount secured"
          value={formatDonationCurrency(totals.amountSecured)}
          valueClassName="text-xl"
        />
        <StatCard
          layout="compact"
          fill
          tone="amber"
          label="Gap"
          value={formatDonationCurrency(totals.gap)}
          valueClassName="text-xl"
        />
      </StatCardsRow>

      <nav
        aria-label="Fundraising Plan views"
        className="flex flex-wrap gap-1 border-b border-border pb-px"
      >
        {planSections.map((item) => {
          const isActive = item.id === section
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

type CampaignFundraisingPlanTabProps = {
  campaignId: string
  organizationId: string
  askLevels: CampaignAskLevelRow[]
  askLevelMetrics: CampaignAskLevelMetrics[]
  canManageStrategy: boolean
  canManageProspects: boolean
  onStrategySaved: () => void
  onProspectsChanged: () => void
  initialFollowUp?: "overdue" | "upcoming" | null
  initialAssignee?: string | null
  initialStage?: string | null
  initialPledged?: "pledged" | "not_pledged" | null
  initialAskType?: CampaignProspectAskType | null
  initialAskLevelId?: string | null
  initialAsked?: boolean
  showHeader?: boolean
}

export function CampaignFundraisingPlanTab({
  campaignId,
  organizationId,
  askLevels,
  askLevelMetrics,
  canManageStrategy,
  canManageProspects,
  onStrategySaved,
  onProspectsChanged,
  initialFollowUp = null,
  initialAssignee = null,
  initialStage = null,
  initialPledged = null,
  initialAskType = null,
  initialAskLevelId = null,
  initialAsked = false,
  showHeader = true,
}: CampaignFundraisingPlanTabProps) {
  const searchParams = useSearchParams()
  const tab = parseCampaignWorkspaceTab(searchParams.get("tab"))
  const section = parseFundraisingPlanSection(tab, searchParams.get("section"))

  return (
    <div className="flex flex-col gap-4">
      {showHeader ? (
        <CampaignFundraisingPlanHeader
          campaignId={campaignId}
          askLevelMetrics={askLevelMetrics}
        />
      ) : null}

      {section === "strategy" ? (
        <CampaignStrategyTab
          campaignId={campaignId}
          askLevels={askLevels}
          askLevelMetrics={askLevelMetrics}
          canManage={canManageStrategy}
          onSaved={onStrategySaved}
        />
      ) : (
        <CampaignProspectsTab
          campaignId={campaignId}
          organizationId={organizationId}
          askLevels={askLevels}
          canManage={canManageProspects}
          onChanged={onProspectsChanged}
          initialFollowUp={initialFollowUp}
          initialAssignee={initialAssignee}
          initialStage={initialStage}
          initialPledged={initialPledged}
          initialAskType={initialAskType}
          initialAskLevelId={initialAskLevelId}
          initialAsked={initialAsked}
        />
      )}
    </div>
  )
}
