"use server"

import { revalidatePath } from "next/cache"

import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"
import {
  SPONSORSHIP_PACKAGE_BENEFIT_SELECT,
  SPONSORSHIP_PACKAGE_SELECT,
  mapSponsorshipPackageBenefitRow,
  mapSponsorshipPackageRow,
  type SponsorshipPackageBenefitInput,
  type SponsorshipPackageBenefitRow,
  type SponsorshipPackageListItem,
  type SponsorshipPackageRow,
  type SponsorshipPackageWriteInput,
} from "@/lib/donations/campaign-sponsorship-types"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

function revalidatePackagePaths(campaignId: string) {
  revalidatePath(`/donations/campaigns/${campaignId}`)
  revalidatePath("/donations/campaigns")
}

function missingPackageSchemaError(message: string) {
  if (
    /sponsorship_packages|sponsorship_package_benefits|campaign_id|campaign_sponsorship_benefits/i.test(
      message
    ) ||
    message.includes("42P01") ||
    message.includes("42703")
  ) {
    return "Sponsorship packages are not available yet. Run scripts/285_campaign_sponsorship_packages.sql in Supabase."
  }
  return null
}

function normalizedBenefits(input: SponsorshipPackageBenefitInput[] | undefined) {
  return (input || [])
    .map((benefit, index) => ({
      id: benefit.id?.trim() || null,
      benefit_type: benefit.benefit_type?.trim() || null,
      name: benefit.name.trim(),
      value: benefit.value?.trim() || null,
      display_order: benefit.display_order ?? index,
    }))
    .filter((benefit) => benefit.name.length > 0)
}

async function replacePackageBenefits(
  writeClient: ReturnType<typeof createServiceRoleClient>,
  orgId: string,
  packageId: string,
  benefits: ReturnType<typeof normalizedBenefits>
) {
  const { data: existing, error: existingError } = await writeClient
    .from("sponsorship_package_benefits")
    .select("id")
    .eq("organization_id", orgId)
    .eq("package_id", packageId)

  if (existingError) return existingError.message

  const keepIds = new Set(benefits.map((benefit) => benefit.id).filter(Boolean) as string[])
  const toDelete = (existing || [])
    .map((row) => row.id as string)
    .filter((id) => !keepIds.has(id))

  if (toDelete.length > 0) {
    const { error } = await writeClient
      .from("sponsorship_package_benefits")
      .delete()
      .eq("organization_id", orgId)
      .in("id", toDelete)
    if (error) return error.message
  }

  for (const benefit of benefits) {
    if (benefit.id) {
      const { error } = await writeClient
        .from("sponsorship_package_benefits")
        .update({
          benefit_type: benefit.benefit_type,
          name: benefit.name,
          value: benefit.value,
          display_order: benefit.display_order,
        })
        .eq("organization_id", orgId)
        .eq("package_id", packageId)
        .eq("id", benefit.id)
      if (error) return error.message
      continue
    }

    const { error } = await writeClient.from("sponsorship_package_benefits").insert({
      organization_id: orgId,
      package_id: packageId,
      benefit_type: benefit.benefit_type,
      name: benefit.name,
      value: benefit.value,
      display_order: benefit.display_order,
    })
    if (error) return error.message
  }

  return null
}

async function loadPackageBenefits(
  orgId: string,
  packageIds: string[]
): Promise<Map<string, SponsorshipPackageBenefitRow[]>> {
  const map = new Map<string, SponsorshipPackageBenefitRow[]>()
  if (packageIds.length === 0) return map

  const writeClient = createServiceRoleClient()
  const { data } = await writeClient
    .from("sponsorship_package_benefits")
    .select(SPONSORSHIP_PACKAGE_BENEFIT_SELECT)
    .eq("organization_id", orgId)
    .in("package_id", packageIds)
    .order("display_order", { ascending: true })

  for (const row of (data || []) as Record<string, unknown>[]) {
    const mapped = mapSponsorshipPackageBenefitRow(row)
    const list = map.get(mapped.package_id) || []
    list.push(mapped)
    map.set(mapped.package_id, list)
  }
  return map
}

export async function listSponsorshipPackagesForCampaignAction(
  campaignId: string,
  options?: { activeOnly?: boolean }
) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  const id = campaignId.trim()
  if (!id) return { success: true as const, packages: [] as SponsorshipPackageRow[] }

  try {
    const writeClient = createServiceRoleClient()
    let query = writeClient
      .from("sponsorship_packages")
      .select(SPONSORSHIP_PACKAGE_SELECT)
      .eq("organization_id", access.orgId)
      .eq("campaign_id", id)
      .order("display_order", { ascending: true })
      .order("amount", { ascending: false })

    if (options?.activeOnly !== false) {
      query = query.eq("active", true)
    }

    const { data, error } = await query
    if (error) {
      const schemaError = missingPackageSchemaError(error.message)
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

export async function fetchCampaignSponsorshipPackagesAction(campaignId: string) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  const id = campaignId.trim()
  if (!id) return { success: false as const, error: "Campaign is required" }

  try {
    const writeClient = createServiceRoleClient()
    const { data, error } = await writeClient
      .from("sponsorship_packages")
      .select(SPONSORSHIP_PACKAGE_SELECT)
      .eq("organization_id", access.orgId)
      .eq("campaign_id", id)
      .order("display_order", { ascending: true })
      .order("amount", { ascending: false })

    if (error) {
      const schemaError = missingPackageSchemaError(error.message)
      if (schemaError || error.code === "42P01") {
        return { success: true as const, packages: [] as SponsorshipPackageListItem[] }
      }
      return { success: false as const, error: error.message }
    }

    const rows = ((data || []) as Record<string, unknown>[]).map(mapSponsorshipPackageRow)
    const packageIds = rows.map((row) => row.id)
    const eventIds = [...new Set(rows.map((row) => row.event_id).filter(Boolean) as string[])]

    const [benefitsByPackage, events, sponsorships] = await Promise.all([
      loadPackageBenefits(access.orgId, packageIds),
      (async () => {
        const map = new Map<string, string>()
        if (eventIds.length === 0) return map
        const { data: eventRows } = await writeClient
          .from("internal_events")
          .select("id, name")
          .eq("organization_id", access.orgId)
          .in("id", eventIds)
        for (const event of eventRows || []) {
          map.set(event.id as string, (event.name as string) || "Event")
        }
        return map
      })(),
      writeClient
        .from("campaign_sponsorships")
        .select(
          "sponsorship_package_id, committed_amount, cash_amount, in_kind_value, status, payment_status"
        )
        .eq("organization_id", access.orgId)
        .eq("campaign_id", id)
        .in(
          "sponsorship_package_id",
          packageIds.length > 0 ? packageIds : ["00000000-0000-0000-0000-000000000000"]
        ),
    ])

    const metrics = new Map<
      string,
      { count: number; committed: number; collected: number; outstanding: number; inKind: number }
    >()
    for (const row of sponsorships.data || []) {
      const packageId = row.sponsorship_package_id as string | null
      if (!packageId) continue
      if (String(row.status || "").toLowerCase() === "cancelled") continue
      const cash = Number(row.cash_amount || 0)
      const payment = String(row.payment_status || "").toLowerCase()
      const current = metrics.get(packageId) || {
        count: 0,
        committed: 0,
        collected: 0,
        outstanding: 0,
        inKind: 0,
      }
      current.count += 1
      current.committed += Number(row.committed_amount || 0)
      current.collected += payment === "paid" ? cash : 0
      current.outstanding += payment === "paid" || payment === "waived" ? 0 : cash
      current.inKind += Number(row.in_kind_value || 0)
      metrics.set(packageId, current)
    }

    const packages: SponsorshipPackageListItem[] = rows.map((row) => {
      const metric = metrics.get(row.id)
      return {
        ...row,
        eventName: row.event_id ? events.get(row.event_id) ?? null : null,
        benefitCount: benefitsByPackage.get(row.id)?.length || 0,
        sponsorCount: metric?.count || 0,
        totalCommitted: metric?.committed || 0,
        totalCollected: metric?.collected || 0,
        outstanding: metric?.outstanding || 0,
        inKindValue: metric?.inKind || 0,
        benefits: benefitsByPackage.get(row.id) || [],
      }
    })

    return { success: true as const, packages }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function getSponsorshipPackageAction(packageId: string) {
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) return { success: false as const, error: access.error }

  if (!packageId.trim()) return { success: false as const, error: "Package is required" }

  try {
    const writeClient = createServiceRoleClient()
    const { data, error } = await writeClient
      .from("sponsorship_packages")
      .select(SPONSORSHIP_PACKAGE_SELECT)
      .eq("organization_id", access.orgId)
      .eq("id", packageId)
      .maybeSingle()

    if (error) {
      return {
        success: false as const,
        error: missingPackageSchemaError(error.message) || error.message,
      }
    }
    if (!data) return { success: false as const, error: "Package not found" }

    const mapped = mapSponsorshipPackageRow(data as Record<string, unknown>)
    const benefits = await loadPackageBenefits(access.orgId, [mapped.id])
    return {
      success: true as const,
      package: {
        ...mapped,
        eventName: null,
        benefitCount: benefits.get(mapped.id)?.length || 0,
        sponsorCount: 0,
        totalCommitted: 0,
        totalCollected: 0,
        outstanding: 0,
        inKindValue: 0,
        benefits: benefits.get(mapped.id) || [],
      } satisfies SponsorshipPackageListItem,
    }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

async function nextDisplayOrder(
  writeClient: ReturnType<typeof createServiceRoleClient>,
  orgId: string,
  campaignId: string
) {
  const { data } = await writeClient
    .from("sponsorship_packages")
    .select("display_order")
    .eq("organization_id", orgId)
    .eq("campaign_id", campaignId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle()
  return Number(data?.display_order || 0) + 1
}

export async function createSponsorshipPackageAction(input: SponsorshipPackageWriteInput) {
  const access = await requireDonationStaffAccess("prospects")
  if (!access.ok) return { success: false as const, error: access.error }

  const campaignId = input.campaign_id?.trim()
  const name = input.name?.trim()
  if (!campaignId) return { success: false as const, error: "Campaign is required" }
  if (!name) return { success: false as const, error: "Package name is required" }
  const amount = Number(input.amount)
  if (!(amount >= 0)) return { success: false as const, error: "Enter a valid package amount" }

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

    const eventId = input.event_id?.trim() || null
    if (eventId) {
      const { data: event, error: eventError } = await writeClient
        .from("internal_events")
        .select("id")
        .eq("organization_id", access.orgId)
        .eq("id", eventId)
        .maybeSingle()
      if (eventError) return { success: false as const, error: eventError.message }
      if (!event) return { success: false as const, error: "Event not found" }
    }

    const displayOrder =
      input.display_order != null
        ? input.display_order
        : await nextDisplayOrder(writeClient, access.orgId, campaignId)

    const { data, error } = await writeClient
      .from("sponsorship_packages")
      .insert({
        organization_id: access.orgId,
        campaign_id: campaignId,
        event_id: eventId,
        name,
        amount,
        description: input.description?.trim() || null,
        display_order: displayOrder,
        active: input.active !== false,
        created_by: access.userId,
      })
      .select(SPONSORSHIP_PACKAGE_SELECT)
      .single()

    if (error || !data) {
      return {
        success: false as const,
        error:
          missingPackageSchemaError(error?.message || "") ||
          error?.message ||
          "Failed to create package",
      }
    }

    const packageId = data.id as string
    const benefitError = await replacePackageBenefits(
      writeClient,
      access.orgId,
      packageId,
      normalizedBenefits(input.benefits)
    )
    if (benefitError) {
      return { success: false as const, error: benefitError }
    }

    revalidatePackagePaths(campaignId)
    return { success: true as const, package: mapSponsorshipPackageRow(data as Record<string, unknown>) }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function updateSponsorshipPackageAction(
  packageId: string,
  input: Partial<SponsorshipPackageWriteInput>
) {
  const access = await requireDonationStaffAccess("prospects")
  if (!access.ok) return { success: false as const, error: access.error }
  if (!packageId.trim()) return { success: false as const, error: "Package is required" }

  try {
    const writeClient = createServiceRoleClient()
    const { data: existing, error: existingError } = await writeClient
      .from("sponsorship_packages")
      .select(SPONSORSHIP_PACKAGE_SELECT)
      .eq("organization_id", access.orgId)
      .eq("id", packageId)
      .maybeSingle()

    if (existingError) return { success: false as const, error: existingError.message }
    if (!existing) return { success: false as const, error: "Package not found" }

    const patch: Record<string, unknown> = {}
    if (input.name !== undefined) {
      const name = input.name.trim()
      if (!name) return { success: false as const, error: "Package name is required" }
      patch.name = name
    }
    if (input.amount !== undefined) {
      const amount = Number(input.amount)
      if (!(amount >= 0)) return { success: false as const, error: "Enter a valid package amount" }
      patch.amount = amount
    }
    if (input.description !== undefined) patch.description = input.description?.trim() || null
    if (input.event_id !== undefined) {
      const eventId = input.event_id?.trim() || null
      if (eventId) {
        const { data: event } = await writeClient
          .from("internal_events")
          .select("id")
          .eq("organization_id", access.orgId)
          .eq("id", eventId)
          .maybeSingle()
        if (!event) return { success: false as const, error: "Event not found" }
      }
      patch.event_id = eventId
    }
    if (input.display_order !== undefined) patch.display_order = input.display_order
    if (input.active !== undefined) patch.active = input.active

    if (Object.keys(patch).length > 0) {
      const { error } = await writeClient
        .from("sponsorship_packages")
        .update(patch)
        .eq("organization_id", access.orgId)
        .eq("id", packageId)
      if (error) return { success: false as const, error: error.message }
    }

    if (input.benefits) {
      const benefitError = await replacePackageBenefits(
        writeClient,
        access.orgId,
        packageId,
        normalizedBenefits(input.benefits)
      )
      if (benefitError) return { success: false as const, error: benefitError }
    }

    revalidatePackagePaths(existing.campaign_id as string)
    return { success: true as const }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

export async function setSponsorshipPackageActiveAction(packageId: string, active: boolean) {
  return updateSponsorshipPackageAction(packageId, { active })
}

export async function duplicateSponsorshipPackageAction(packageId: string) {
  const access = await requireDonationStaffAccess("prospects")
  if (!access.ok) return { success: false as const, error: access.error }

  const existing = await getSponsorshipPackageAction(packageId)
  if (!existing.success) return existing

  return createSponsorshipPackageAction({
    campaign_id: existing.package.campaign_id,
    event_id: existing.package.event_id,
    name: `${existing.package.name} Copy`,
    amount: existing.package.amount,
    description: existing.package.description,
    active: existing.package.active,
    benefits: existing.package.benefits.map((benefit) => ({
      benefit_type: benefit.benefit_type,
      name: benefit.name,
      value: benefit.value,
      display_order: benefit.display_order,
    })),
  })
}

export async function deleteSponsorshipPackageAction(packageId: string) {
  const access = await requireDonationStaffAccess("prospects")
  if (!access.ok) return { success: false as const, error: access.error }
  if (!packageId.trim()) return { success: false as const, error: "Package is required" }

  try {
    const writeClient = createServiceRoleClient()
    const { data: existing, error: existingError } = await writeClient
      .from("sponsorship_packages")
      .select("id, campaign_id, name")
      .eq("organization_id", access.orgId)
      .eq("id", packageId)
      .maybeSingle()

    if (existingError) return { success: false as const, error: existingError.message }
    if (!existing) return { success: false as const, error: "Package not found" }

    const [{ count: sponsorshipCount }, { count: prospectCount }] = await Promise.all([
      writeClient
        .from("campaign_sponsorships")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", access.orgId)
        .eq("sponsorship_package_id", packageId),
      writeClient
        .from("campaign_prospects")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", access.orgId)
        .eq("sponsorship_package_id", packageId),
    ])

    if ((sponsorshipCount || 0) > 0 || (prospectCount || 0) > 0) {
      await writeClient
        .from("sponsorship_packages")
        .update({ active: false })
        .eq("organization_id", access.orgId)
        .eq("id", packageId)
      revalidatePackagePaths(existing.campaign_id as string)
      return {
        success: false as const,
        error:
          "This package is used by a prospect or sponsor, so it was deactivated instead of deleted.",
        deactivated: true as const,
      }
    }

    const { error } = await writeClient
      .from("sponsorship_packages")
      .delete()
      .eq("organization_id", access.orgId)
      .eq("id", packageId)

    if (error) return { success: false as const, error: error.message }

    revalidatePackagePaths(existing.campaign_id as string)
    return { success: true as const }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}
