"use server"

import { revalidatePath } from "next/cache"

import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"
import { linkedCampaignIdFromConfig } from "@/lib/events/event-finance-types"
import {
  CAMPAIGN_PROSPECT_SELECT,
  normalizeProspectAskType,
} from "@/lib/donations/campaign-prospect-types"
import {
  CAMPAIGN_SPONSORSHIP_BENEFIT_SELECT,
  CAMPAIGN_SPONSORSHIP_SELECT,
  CUSTOM_SPONSORSHIP_PACKAGE_VALUE,
  SPONSORSHIP_PACKAGE_BENEFIT_SELECT,
  SPONSORSHIP_PACKAGE_SELECT,
  mapSponsorshipPackageRow,
  normalizeSponsorshipBenefitStatus,
  normalizeSponsorshipPaymentStatus,
  normalizeSponsorshipStatus,
  normalizeSponsorshipType,
  type CampaignLinkedEventOption,
  type CampaignSponsorshipBenefitRow,
  type CampaignSponsorshipListItem,
  type CampaignSponsorshipRow,
  type CampaignSponsorshipWriteInput,
  type SponsorshipBenefitStatus,
  type SponsorshipPackageRow,
} from "@/lib/donations/campaign-sponsorship-types"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

function revalidateSponsorshipPaths(campaignId: string) {
  revalidatePath(`/donations/campaigns/${campaignId}`)
  revalidatePath("/donations/campaigns")
  revalidatePath("/donations")
}

function missingSponsorshipSchemaError(message: string) {
  if (
    /sponsorship_packages|campaign_sponsorships|ask_type|converted_sponsorship/i.test(message) ||
    message.includes("42P01") ||
    message.includes("42703")
  ) {
    return "Sponsorships are not available yet. Run scripts/284_campaign_sponsorship_prospects.sql and scripts/285_campaign_sponsorship_packages.sql in Supabase."
  }
  return null
}

function mapSponsorshipBenefitRow(row: Record<string, unknown>): CampaignSponsorshipBenefitRow {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    sponsorship_id: row.sponsorship_id as string,
    package_benefit_id: (row.package_benefit_id as string | null) ?? null,
    name: (row.name as string) || "Benefit",
    value: (row.value as string | null) ?? null,
    status: normalizeSponsorshipBenefitStatus(row.status as string),
    completed_at: (row.completed_at as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    display_order: Number(row.display_order || 0),
  }
}

function mapSponsorshipRow(row: Record<string, unknown>): CampaignSponsorshipRow {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    campaign_id: row.campaign_id as string,
    event_id: (row.event_id as string | null) ?? null,
    contact_id: row.contact_id as string,
    prospect_id: (row.prospect_id as string | null) ?? null,
    sponsorship_package_id: (row.sponsorship_package_id as string | null) ?? null,
    sponsorship_type: normalizeSponsorshipType(row.sponsorship_type as string),
    committed_amount: Number(row.committed_amount || 0),
    cash_amount: Number(row.cash_amount || 0),
    in_kind_value: Number(row.in_kind_value || 0),
    status: normalizeSponsorshipStatus(row.status as string),
    payment_status: normalizeSponsorshipPaymentStatus(row.payment_status as string),
    committed_date: (row.committed_date as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    created_at: (row.created_at as string | null) ?? null,
    updated_at: (row.updated_at as string | null) ?? null,
  }
}

async function loadContactNames(
  orgId: string,
  contactIds: string[]
): Promise<Map<string, { name: string; email: string | null }>> {
  const map = new Map<string, { name: string; email: string | null }>()
  if (contactIds.length === 0) return map

  const writeClient = createServiceRoleClient()
  const { data } = await writeClient
    .from("contacts")
    .select("id, full_name, email")
    .eq("organization_id", orgId)
    .in("id", contactIds)

  for (const row of data || []) {
    map.set(row.id as string, {
      name: (row.full_name as string) || "Unnamed contact",
      email: (row.email as string | null) ?? null,
    })
  }
  return map
}

async function loadEventNames(orgId: string, eventIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (eventIds.length === 0) return map

  const writeClient = createServiceRoleClient()
  const { data } = await writeClient
    .from("internal_events")
    .select("id, name")
    .eq("organization_id", orgId)
    .in("id", eventIds)

  for (const row of data || []) {
    map.set(row.id as string, (row.name as string) || "Event")
  }
  return map
}

async function loadPackageNames(
  orgId: string,
  packageIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (packageIds.length === 0) return map

  const writeClient = createServiceRoleClient()
  const { data } = await writeClient
    .from("sponsorship_packages")
    .select("id, name")
    .eq("organization_id", orgId)
    .in("id", packageIds)

  for (const row of data || []) {
    map.set(row.id as string, (row.name as string) || "Package")
  }
  return map
}

async function enrichSponsorships(
  orgId: string,
  rows: CampaignSponsorshipRow[]
): Promise<CampaignSponsorshipListItem[]> {
  const contactIds = [...new Set(rows.map((row) => row.contact_id))]
  const eventIds = [...new Set(rows.map((row) => row.event_id).filter(Boolean) as string[])]
  const packageIds = [
    ...new Set(rows.map((row) => row.sponsorship_package_id).filter(Boolean) as string[]),
  ]
  const prospectIds = [...new Set(rows.map((row) => row.prospect_id).filter(Boolean) as string[])]
  const sponsorshipIds = rows.map((row) => row.id)

  const [contacts, events, packages, prospects, benefitRows] = await Promise.all([
    loadContactNames(orgId, contactIds),
    loadEventNames(orgId, eventIds),
    loadPackageNames(orgId, packageIds),
    (async () => {
      const map = new Map<string, { assignedToName: string | null }>()
      if (prospectIds.length === 0) return map
      const writeClient = createServiceRoleClient()
      const { data } = await writeClient
        .from("campaign_prospects")
        .select("id, assigned_to_contact_id")
        .eq("organization_id", orgId)
        .in("id", prospectIds)
      const assigneeIds = [
        ...new Set(
          (data || [])
            .map((row) => row.assigned_to_contact_id as string | null)
            .filter(Boolean) as string[]
        ),
      ]
      const assignees = await loadContactNames(orgId, assigneeIds)
      for (const row of data || []) {
        const assigneeId = row.assigned_to_contact_id as string | null
        map.set(row.id as string, {
          assignedToName: assigneeId ? assignees.get(assigneeId)?.name ?? null : null,
        })
      }
      return map
    })(),
    (async () => {
      const map = new Map<string, { completed: number; total: number }>()
      if (sponsorshipIds.length === 0) return map
      const writeClient = createServiceRoleClient()
      const { data } = await writeClient
        .from("campaign_sponsorship_benefits")
        .select("sponsorship_id, status")
        .eq("organization_id", orgId)
        .in("sponsorship_id", sponsorshipIds)
      for (const row of data || []) {
        const id = row.sponsorship_id as string
        const current = map.get(id) || { completed: 0, total: 0 }
        current.total += 1
        if (String(row.status || "").toLowerCase() === "completed") current.completed += 1
        map.set(id, current)
      }
      return map
    })(),
  ])

  return rows.map((row) => {
    const benefits = benefitRows.get(row.id)
    return {
      ...row,
      contactName: contacts.get(row.contact_id)?.name || "Unknown contact",
      contactEmail: contacts.get(row.contact_id)?.email ?? null,
      eventName: row.event_id ? events.get(row.event_id) ?? null : null,
      packageName: row.sponsorship_package_id
        ? packages.get(row.sponsorship_package_id) ?? null
        : null,
      assignedToName: row.prospect_id
        ? prospects.get(row.prospect_id)?.assignedToName ?? null
        : null,
      prospectId: row.prospect_id,
      benefitsCompleted: benefits?.completed || 0,
      benefitsTotal: benefits?.total || 0,
    }
  })
}

export async function listCampaignLinkedEventsAction(campaignId: string) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  const id = campaignId.trim()
  if (!id) return { success: false as const, error: "Campaign is required" }

  try {
    const writeClient = createServiceRoleClient()
    const { data, error } = await writeClient
      .from("internal_events")
      .select("id, name, start_at, ticketing_config")
      .eq("organization_id", access.orgId)
      .order("start_at", { ascending: false, nullsFirst: false })
      .limit(80)

    if (error) {
      return { success: false as const, error: error.message }
    }

    const events: CampaignLinkedEventOption[] = (data || []).map((row) => ({
      id: row.id as string,
      name: (row.name as string) || "Untitled event",
      startAt: (row.start_at as string | null) ?? null,
      linkedToCampaign:
        linkedCampaignIdFromConfig(
          row.ticketing_config as { linkedCampaignId?: string | null } | null
        ) === id,
    }))

    events.sort((a, b) => {
      if (a.linkedToCampaign !== b.linkedToCampaign) return a.linkedToCampaign ? -1 : 1
      return (b.startAt || "").localeCompare(a.startAt || "")
    })

    return { success: true as const, events }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function listSponsorshipPackagesForEventAction(eventId: string) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  const id = eventId.trim()
  if (!id) return { success: true as const, packages: [] as SponsorshipPackageRow[] }

  try {
    const writeClient = createServiceRoleClient()
    const { data, error } = await writeClient
      .from("sponsorship_packages")
      .select(SPONSORSHIP_PACKAGE_SELECT)
      .eq("organization_id", access.orgId)
      .eq("event_id", id)
      .eq("active", true)
      .order("display_order", { ascending: true })
      .order("amount", { ascending: false })

    if (error) {
      const schemaError = missingSponsorshipSchemaError(error.message)
      if (schemaError || error.code === "42P01") {
        return { success: true as const, packages: [] as SponsorshipPackageRow[] }
      }
      return { success: false as const, error: error.message }
    }

    return {
      success: true as const,
      packages: ((data || []) as Record<string, unknown>[]).map(mapSponsorshipPackageRow),
    }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function fetchCampaignSponsorshipsAction(campaignId: string) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  const id = campaignId.trim()
  if (!id) return { success: false as const, error: "Campaign is required" }

  try {
    const writeClient = createServiceRoleClient()
    const { data, error } = await writeClient
      .from("campaign_sponsorships")
      .select(CAMPAIGN_SPONSORSHIP_SELECT)
      .eq("organization_id", access.orgId)
      .eq("campaign_id", id)
      .order("committed_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })

    if (error) {
      const schemaError = missingSponsorshipSchemaError(error.message)
      if (schemaError || error.code === "42P01") {
        return { success: true as const, sponsorships: [] as CampaignSponsorshipListItem[] }
      }
      return { success: false as const, error: error.message }
    }

    const rows = ((data || []) as Record<string, unknown>[]).map(mapSponsorshipRow)
    const sponsorships = await enrichSponsorships(access.orgId, rows)
    return { success: true as const, sponsorships }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function getCampaignSponsorshipAction(sponsorshipId: string) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  if (!sponsorshipId.trim()) {
    return { success: false as const, error: "Sponsorship is required" }
  }

  try {
    const writeClient = createServiceRoleClient()
    const { data, error } = await writeClient
      .from("campaign_sponsorships")
      .select(CAMPAIGN_SPONSORSHIP_SELECT)
      .eq("organization_id", access.orgId)
      .eq("id", sponsorshipId)
      .maybeSingle()

    if (error) {
      return {
        success: false as const,
        error: missingSponsorshipSchemaError(error.message) || error.message,
      }
    }
    if (!data) return { success: false as const, error: "Sponsorship not found" }

    const [enriched] = await enrichSponsorships(access.orgId, [
      mapSponsorshipRow(data as Record<string, unknown>),
    ])
    const benefits = await listSponsorshipBenefits(access.orgId, sponsorshipId)
    return { success: true as const, sponsorship: enriched, benefits }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

async function listSponsorshipBenefits(orgId: string, sponsorshipId: string) {
  const writeClient = createServiceRoleClient()
  const { data, error } = await writeClient
    .from("campaign_sponsorship_benefits")
    .select(CAMPAIGN_SPONSORSHIP_BENEFIT_SELECT)
    .eq("organization_id", orgId)
    .eq("sponsorship_id", sponsorshipId)
    .order("display_order", { ascending: true })

  if (error || !data) return [] as CampaignSponsorshipBenefitRow[]
  return (data as Record<string, unknown>[]).map(mapSponsorshipBenefitRow)
}

export async function listCampaignSponsorshipBenefitsAction(sponsorshipId: string) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }
  if (!sponsorshipId.trim()) return { success: false as const, error: "Sponsorship is required" }

  try {
    const benefits = await listSponsorshipBenefits(access.orgId, sponsorshipId)
    return { success: true as const, benefits }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function updateCampaignSponsorshipBenefitAction(
  benefitId: string,
  input: { status?: SponsorshipBenefitStatus; notes?: string | null }
) {
  const access = await requireDonationStaffAccess("prospects")
  if (!access.ok) return { success: false as const, error: access.error }
  if (!benefitId.trim()) return { success: false as const, error: "Benefit is required" }

  try {
    const writeClient = createServiceRoleClient()
    const { data: existing, error: existingError } = await writeClient
      .from("campaign_sponsorship_benefits")
      .select("id, sponsorship_id, status")
      .eq("organization_id", access.orgId)
      .eq("id", benefitId)
      .maybeSingle()

    if (existingError) return { success: false as const, error: existingError.message }
    if (!existing) return { success: false as const, error: "Benefit not found" }

    const patch: Record<string, unknown> = {}
    if (input.status !== undefined) {
      patch.status = normalizeSponsorshipBenefitStatus(input.status)
      patch.completed_at =
        input.status === "completed" ? new Date().toISOString() : null
    }
    if (input.notes !== undefined) patch.notes = input.notes?.trim() || null

    const { data, error } = await writeClient
      .from("campaign_sponsorship_benefits")
      .update(patch)
      .eq("organization_id", access.orgId)
      .eq("id", benefitId)
      .select(CAMPAIGN_SPONSORSHIP_BENEFIT_SELECT)
      .maybeSingle()

    if (error || !data) {
      return { success: false as const, error: error?.message || "Failed to update benefit" }
    }

    const { data: sponsorship } = await writeClient
      .from("campaign_sponsorships")
      .select("campaign_id")
      .eq("organization_id", access.orgId)
      .eq("id", existing.sponsorship_id)
      .maybeSingle()
    if (sponsorship?.campaign_id) {
      revalidateSponsorshipPaths(sponsorship.campaign_id as string)
    }

    return {
      success: true as const,
      benefit: mapSponsorshipBenefitRow(data as Record<string, unknown>),
    }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

function resolvedPackageId(value: string | null | undefined) {
  if (!value || value === CUSTOM_SPONSORSHIP_PACKAGE_VALUE) return null
  return value
}

async function snapshotPackageBenefitsForSponsorship(
  writeClient: ReturnType<typeof createServiceRoleClient>,
  orgId: string,
  sponsorshipId: string,
  packageId: string
) {
  const { data: existing } = await writeClient
    .from("campaign_sponsorship_benefits")
    .select("id")
    .eq("organization_id", orgId)
    .eq("sponsorship_id", sponsorshipId)
    .limit(1)

  if ((existing || []).length > 0) return

  const { data: benefits, error } = await writeClient
    .from("sponsorship_package_benefits")
    .select(SPONSORSHIP_PACKAGE_BENEFIT_SELECT)
    .eq("organization_id", orgId)
    .eq("package_id", packageId)
    .order("display_order", { ascending: true })

  if (error || !benefits || benefits.length === 0) return

  await writeClient.from("campaign_sponsorship_benefits").insert(
    benefits.map((benefit, index) => ({
      organization_id: orgId,
      sponsorship_id: sponsorshipId,
      package_benefit_id: benefit.id,
      name: benefit.name,
      value: (benefit.value as string | null) ?? null,
      status: "pending",
      display_order: Number(benefit.display_order ?? index),
    }))
  )
}

export async function createCampaignSponsorshipAction(
  campaignId: string,
  input: CampaignSponsorshipWriteInput
) {
  const access = await requireDonationStaffAccess("prospects")
  if (!access.ok) return { success: false as const, error: access.error }

  const contactId = input.contact_id?.trim()
  if (!contactId) return { success: false as const, error: "Contact is required" }
  if (!campaignId.trim()) return { success: false as const, error: "Campaign is required" }

  const committed = Number(input.committed_amount)
  if (!(committed > 0)) {
    return { success: false as const, error: "Enter a valid sponsorship amount" }
  }

  try {
    const writeClient = createServiceRoleClient()

    const { data: campaign, error: campaignError } = await writeClient
      .from("campaigns")
      .select("id")
      .eq("organization_id", access.orgId)
      .eq("id", campaignId)
      .maybeSingle()

    if (campaignError) return { success: false as const, error: campaignError.message }
    if (!campaign) return { success: false as const, error: "Campaign not found" }

    const { data: contact, error: contactError } = await writeClient
      .from("contacts")
      .select("id")
      .eq("organization_id", access.orgId)
      .eq("id", contactId)
      .maybeSingle()

    if (contactError) return { success: false as const, error: contactError.message }
    if (!contact) return { success: false as const, error: "Contact not found" }

    const sponsorshipType = normalizeSponsorshipType(input.sponsorship_type)
    const cashAmount =
      input.cash_amount != null
        ? Number(input.cash_amount)
        : sponsorshipType === "in_kind"
          ? 0
          : committed
    const inKindValue =
      input.in_kind_value != null
        ? Number(input.in_kind_value)
        : sponsorshipType === "in_kind"
          ? committed
          : 0

    const { data, error } = await writeClient
      .from("campaign_sponsorships")
      .insert({
        organization_id: access.orgId,
        campaign_id: campaignId,
        event_id: input.event_id || null,
        contact_id: contactId,
        prospect_id: input.prospect_id || null,
        sponsorship_package_id: resolvedPackageId(input.sponsorship_package_id),
        sponsorship_type: sponsorshipType,
        committed_amount: committed,
        cash_amount: Number.isFinite(cashAmount) ? cashAmount : 0,
        in_kind_value: Number.isFinite(inKindValue) ? inKindValue : 0,
        status: normalizeSponsorshipStatus(input.status),
        payment_status: normalizeSponsorshipPaymentStatus(input.payment_status),
        committed_date: input.committed_date || new Date().toISOString().slice(0, 10),
        notes: input.notes?.trim() || null,
        created_by: access.userId,
      })
      .select(CAMPAIGN_SPONSORSHIP_SELECT)
      .single()

    if (error || !data) {
      return {
        success: false as const,
        error:
          missingSponsorshipSchemaError(error?.message || "") ||
          error?.message ||
          "Failed to create sponsorship",
      }
    }

    const createdRow = mapSponsorshipRow(data as Record<string, unknown>)
    const packageId = resolvedPackageId(input.sponsorship_package_id)
    if (packageId) {
      await snapshotPackageBenefitsForSponsorship(
        writeClient,
        access.orgId,
        createdRow.id,
        packageId
      )
    }

    revalidateSponsorshipPaths(campaignId)
    const [enriched] = await enrichSponsorships(access.orgId, [createdRow])
    return { success: true as const, sponsorship: enriched }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function updateCampaignSponsorshipAction(
  sponsorshipId: string,
  input: Partial<CampaignSponsorshipWriteInput>
) {
  const access = await requireDonationStaffAccess("prospects")
  if (!access.ok) return { success: false as const, error: access.error }

  if (!sponsorshipId.trim()) {
    return { success: false as const, error: "Sponsorship is required" }
  }

  try {
    const writeClient = createServiceRoleClient()
    const { data: existing, error: existingError } = await writeClient
      .from("campaign_sponsorships")
      .select(CAMPAIGN_SPONSORSHIP_SELECT)
      .eq("organization_id", access.orgId)
      .eq("id", sponsorshipId)
      .maybeSingle()

    if (existingError) return { success: false as const, error: existingError.message }
    if (!existing) return { success: false as const, error: "Sponsorship not found" }

    const patch: Record<string, unknown> = {}
    if (input.event_id !== undefined) patch.event_id = input.event_id || null
    if (input.sponsorship_package_id !== undefined) {
      patch.sponsorship_package_id = resolvedPackageId(input.sponsorship_package_id)
    }
    if (input.sponsorship_type !== undefined) {
      patch.sponsorship_type = normalizeSponsorshipType(input.sponsorship_type)
    }
    if (input.committed_amount !== undefined) patch.committed_amount = input.committed_amount
    if (input.cash_amount !== undefined) patch.cash_amount = input.cash_amount ?? 0
    if (input.in_kind_value !== undefined) patch.in_kind_value = input.in_kind_value ?? 0
    if (input.status !== undefined) patch.status = normalizeSponsorshipStatus(input.status)
    if (input.payment_status !== undefined) {
      patch.payment_status = normalizeSponsorshipPaymentStatus(input.payment_status)
    }
    if (input.committed_date !== undefined) {
      patch.committed_date = input.committed_date || null
    }
    if (input.notes !== undefined) patch.notes = input.notes?.trim() || null

    const { data, error } = await writeClient
      .from("campaign_sponsorships")
      .update(patch)
      .eq("organization_id", access.orgId)
      .eq("id", sponsorshipId)
      .select(CAMPAIGN_SPONSORSHIP_SELECT)
      .maybeSingle()

    if (error || !data) {
      return {
        success: false as const,
        error: error?.message || "Failed to update sponsorship",
      }
    }

    const updatedRow = mapSponsorshipRow(data as Record<string, unknown>)
    const packageId = resolvedPackageId(updatedRow.sponsorship_package_id)
    if (packageId) {
      await snapshotPackageBenefitsForSponsorship(
        writeClient,
        access.orgId,
        updatedRow.id,
        packageId
      )
    }

    revalidateSponsorshipPaths(existing.campaign_id as string)
    const [enriched] = await enrichSponsorships(access.orgId, [updatedRow])
    return { success: true as const, sponsorship: enriched }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

/**
 * Create one campaign_sponsorships row from a sponsorship prospect and link them.
 * Does not create a donation or pledge.
 */
export async function convertCampaignProspectToSponsorshipAction(input: {
  prospectId: string
  committedAmount: number
  sponsorshipType?: string | null
  cashAmount?: number | null
  inKindValue?: number | null
  eventId?: string | null
  sponsorshipPackageId?: string | null
  status?: string | null
  paymentStatus?: string | null
  committedDate?: string | null
  notes?: string | null
}) {
  const access = await requireDonationStaffAccess("prospects")
  if (!access.ok) return { success: false as const, error: access.error }

  const amount = Number(input.committedAmount)
  if (!(amount > 0)) {
    return { success: false as const, error: "Enter a valid sponsorship amount" }
  }

  try {
    const writeClient = createServiceRoleClient()
    const { data: existing, error: existingError } = await writeClient
      .from("campaign_prospects")
      .select(CAMPAIGN_PROSPECT_SELECT)
      .eq("organization_id", access.orgId)
      .eq("id", input.prospectId)
      .maybeSingle()

    if (existingError) {
      return {
        success: false as const,
        error: missingSponsorshipSchemaError(existingError.message) || existingError.message,
      }
    }
    if (!existing) return { success: false as const, error: "Prospect not found" }

    const askType = normalizeProspectAskType(existing.ask_type as string)
    if (askType !== "sponsorship") {
      return {
        success: false as const,
        error: "Use Record Pledge for donation prospects",
      }
    }
    if (existing.converted_sponsorship_id) {
      return {
        success: false as const,
        error: "This prospect already has a linked sponsorship",
        sponsorshipId: existing.converted_sponsorship_id as string,
      }
    }
    if (existing.converted_pledge_id) {
      return {
        success: false as const,
        error: "This prospect is already linked to a pledge",
      }
    }

    const created = await createCampaignSponsorshipAction(existing.campaign_id as string, {
      contact_id: existing.contact_id as string,
      event_id: input.eventId ?? ((existing.event_id as string | null) || null),
      prospect_id: existing.id as string,
      sponsorship_package_id:
        input.sponsorshipPackageId ??
        ((existing.sponsorship_package_id as string | null) || null),
      sponsorship_type: normalizeSponsorshipType(input.sponsorshipType),
      committed_amount: amount,
      cash_amount: input.cashAmount,
      in_kind_value: input.inKindValue,
      status: normalizeSponsorshipStatus(input.status),
      payment_status: normalizeSponsorshipPaymentStatus(input.paymentStatus),
      committed_date: input.committedDate || new Date().toISOString().slice(0, 10),
      notes: input.notes,
    })

    if (!created.success) return created

    const { error: prospectUpdateError } = await writeClient
      .from("campaign_prospects")
      .update({
        stage: "pledged",
        converted_sponsorship_id: created.sponsorship.id,
      })
      .eq("organization_id", access.orgId)
      .eq("id", existing.id)

    if (prospectUpdateError) {
      await writeClient
        .from("campaign_sponsorships")
        .delete()
        .eq("organization_id", access.orgId)
        .eq("id", created.sponsorship.id)
      return { success: false as const, error: prospectUpdateError.message }
    }

    revalidateSponsorshipPaths(existing.campaign_id as string)
    return {
      success: true as const,
      sponsorshipId: created.sponsorship.id,
      committedAmount: created.sponsorship.committed_amount,
      campaignId: existing.campaign_id as string,
      contactId: existing.contact_id as string,
    }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function sumActiveCampaignSponsorships(
  organizationId: string,
  campaignId: string
): Promise<{
  sponsorCount: number
  committed: number
  cash: number
  collected: number
  outstanding: number
  inKind: number
}> {
  const empty = {
    sponsorCount: 0,
    committed: 0,
    cash: 0,
    collected: 0,
    outstanding: 0,
    inKind: 0,
  }
  try {
    const writeClient = createServiceRoleClient()
    const { data, error } = await writeClient
      .from("campaign_sponsorships")
      .select("committed_amount, cash_amount, in_kind_value, status, payment_status")
      .eq("organization_id", organizationId)
      .eq("campaign_id", campaignId)

    if (error || !data) return empty

    return data.reduce((sum, row) => {
      const status = String(row.status || "").toLowerCase()
      if (status === "cancelled") return sum
      const cash = Number(row.cash_amount || 0)
      const payment = String(row.payment_status || "").toLowerCase()
      const collected = payment === "paid" ? cash : 0
      const outstanding = payment === "paid" || payment === "waived" ? 0 : cash
      return {
        sponsorCount: sum.sponsorCount + 1,
        committed: sum.committed + Number(row.committed_amount || 0),
        cash: sum.cash + cash,
        collected: sum.collected + collected,
        outstanding: sum.outstanding + outstanding,
        inKind: sum.inKind + Number(row.in_kind_value || 0),
      }
    }, empty)
  } catch {
    return empty
  }
}

