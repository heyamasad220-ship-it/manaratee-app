"use client"

import { useRouter, useSearchParams } from "next/navigation"

import { CampaignProspectsTab } from "@/components/donations/campaign-prospects-tab"
import { CampaignStrategyTab } from "@/components/donations/campaign-strategy-tab"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type {
  CampaignAskLevelMetrics,
  CampaignAskLevelRow,
} from "@/lib/donations/campaign-ask-level-types"
import type { CampaignProspectAskType } from "@/lib/donations/campaign-prospect-types"
import {
  donationCampaignWorkspaceHref,
  parseCampaignWorkspaceTab,
  parseFundraisingPlanSection,
  type FundraisingPlanSection,
} from "@/lib/donations/campaign-workspace-paths"

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
}: CampaignFundraisingPlanTabProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab = parseCampaignWorkspaceTab(searchParams.get("tab"))
  const section = parseFundraisingPlanSection(tab, searchParams.get("section"))

  function setSection(next: FundraisingPlanSection) {
    router.replace(
      donationCampaignWorkspaceHref(campaignId, {
        tab: "plan",
        section: next === "prospects" ? "prospects" : undefined,
      })
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Fundraising Plan</h2>
        <p className="text-sm text-muted-foreground">
          Plan your campaign ask levels, assign prospects, and track progress toward your
          fundraising targets.
        </p>
      </div>

      <ToggleGroup
        type="single"
        value={section}
        onValueChange={(value) => {
          if (value === "strategy" || value === "prospects") setSection(value)
        }}
        variant="outline"
        size="sm"
        aria-label="Fundraising Plan views"
        className="w-fit bg-muted/40"
      >
        <ToggleGroupItem
          value="strategy"
          className="px-3 data-[state=on]:bg-background data-[state=on]:shadow-sm"
        >
          Ask Strategy
        </ToggleGroupItem>
        <ToggleGroupItem
          value="prospects"
          className="px-3 data-[state=on]:bg-background data-[state=on]:shadow-sm"
        >
          Prospects
        </ToggleGroupItem>
      </ToggleGroup>

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
