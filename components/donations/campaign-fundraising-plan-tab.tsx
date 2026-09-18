"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"

import {
  CampaignFundraisingPlanTable,
  type FundraisingPlanSaveInput,
} from "@/components/donations/campaign-fundraising-plan-table"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"
import {
  createCampaignProspectAction,
  deleteCampaignProspectAction,
  fetchCampaignFundraisingPlanProspectsAction,
  updateCampaignProspectAction,
} from "@/lib/donations/campaign-prospect-actions"
import {
  computeCampaignFundraisingPlanKpis,
  type CampaignFundraisingPlanKpis,
  type CampaignProspectListItem,
} from "@/lib/donations/campaign-prospect-types"

export function CampaignFundraisingPlanHeader({
  kpis,
}: {
  kpis: CampaignFundraisingPlanKpis | null
}) {
  const values = kpis || {
    prospectCount: 0,
    totalAsk: 0,
    overdueCount: 0,
    pledgedAmount: 0,
  }

  return (
    <StatCardsRow equal columns={4} className="gap-3">
      <StatCard
        layout="compact"
        fill
        tone="violet"
        label="Prospects"
        value={values.prospectCount.toLocaleString()}
        valueClassName="text-xl"
      />
      <StatCard
        layout="compact"
        fill
        tone="sky"
        label="Total ask"
        value={formatDonationCurrency(values.totalAsk)}
        valueClassName="text-xl"
      />
      <StatCard
        layout="compact"
        fill
        tone="amber"
        label="Overdue follow-ups"
        value={values.overdueCount.toLocaleString()}
        valueClassName="text-xl"
      />
      <StatCard
        layout="compact"
        fill
        tone="emerald"
        label="Pledged"
        value={formatDonationCurrency(values.pledgedAmount)}
        valueClassName="text-xl"
      />
    </StatCardsRow>
  )
}

type CampaignFundraisingPlanTabProps = {
  campaignId: string
  organizationId: string
  canManageProspects: boolean
  onProspectsChanged: () => void
  onKpisChange?: (kpis: CampaignFundraisingPlanKpis) => void
  showHeader?: boolean
}

export function CampaignFundraisingPlanTab({
  campaignId,
  organizationId,
  canManageProspects,
  onProspectsChanged,
  onKpisChange,
  showHeader = true,
}: CampaignFundraisingPlanTabProps) {
  const searchParams = useSearchParams()
  const followUpParam = searchParams.get("followUp")
  const followUpFilter =
    followUpParam === "overdue" || followUpParam === "upcoming" ? followUpParam : null
  const assigneeFilter = searchParams.get("assignee")

  const [prospects, setProspects] = useState<CampaignProspectListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const kpis = useMemo(() => computeCampaignFundraisingPlanKpis(prospects), [prospects])

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true)
    setErrorMessage(null)
    const prospectResult = await fetchCampaignFundraisingPlanProspectsAction(campaignId)
    if (!prospectResult.success) {
      setErrorMessage(prospectResult.error)
      setProspects([])
      setLoading(false)
      return
    }
    setProspects(prospectResult.prospects)
    setLoading(false)
  }, [campaignId])

  useEffect(() => {
    void load(true)
  }, [load])

  useEffect(() => {
    onKpisChange?.(kpis)
  }, [kpis, onKpisChange])

  async function addProspect(input: FundraisingPlanSaveInput) {
    setSaving(true)
    setErrorMessage(null)
    const result = await createCampaignProspectAction(campaignId, {
      contact_id: input.contact_id,
      ask_type: "donation",
      ask_level_id: null,
      suggested_ask_amount: input.suggested_ask_amount,
      assigned_to_contact_id: input.assigned_to_contact_id,
      last_contacted_at: input.last_contacted_at,
      next_follow_up_at: input.next_follow_up_at,
      notes: input.notes,
      stage: "identified",
    })
    setSaving(false)
    if (!result.success) {
      setErrorMessage(result.error)
      return false
    }
    setProspects((current) =>
      [...current, result.prospect].sort((a, b) => a.contactName.localeCompare(b.contactName))
    )
    return true
  }

  async function saveProspect(prospectId: string, input: FundraisingPlanSaveInput) {
    setSaving(true)
    setErrorMessage(null)
    const result = await updateCampaignProspectAction(prospectId, {
      suggested_ask_amount: input.suggested_ask_amount,
      ask_level_id: null,
      assigned_to_contact_id: input.assigned_to_contact_id,
      last_contacted_at: input.last_contacted_at,
      next_follow_up_at: input.next_follow_up_at,
      notes: input.notes,
    })
    setSaving(false)
    if (!result.success) {
      setErrorMessage(result.error)
      return false
    }
    setProspects((current) =>
      current.map((row) => (row.id === prospectId ? result.prospect : row))
    )
    return true
  }

  async function deleteProspect(prospectId: string) {
    setErrorMessage(null)
    const result = await deleteCampaignProspectAction(prospectId)
    if (!result.success) {
      setErrorMessage(result.error)
      return false
    }
    setProspects((current) => current.filter((row) => row.id !== prospectId))
    return true
  }

  return (
    <div className="flex flex-col gap-4">
      {showHeader ? <CampaignFundraisingPlanHeader kpis={kpis} /> : null}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading prospects...</p>
      ) : (
        <CampaignFundraisingPlanTable
          campaignId={campaignId}
          organizationId={organizationId}
          prospects={prospects}
          canManage={canManageProspects}
          followUpFilter={followUpFilter}
          assigneeFilter={assigneeFilter}
          saving={saving}
          errorMessage={errorMessage}
          onSaveProspect={saveProspect}
          onAddProspect={addProspect}
          onDeleteProspect={deleteProspect}
          onPledgeChanged={() => {
            void load(false)
            onProspectsChanged()
          }}
        />
      )}
    </div>
  )
}
