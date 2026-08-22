import type { SupabaseClient } from "@supabase/supabase-js"

export type PaymentAttribution = {
  campaign_id: string | null
  category_id: string | null
  subcategory_id: string | null
  wishlist_item_id: string | null
}

export const EMPTY_PAYMENT_ATTRIBUTION: PaymentAttribution = {
  campaign_id: null,
  category_id: null,
  subcategory_id: null,
  wishlist_item_id: null,
}

export function mergePaymentAttribution(
  primary: Partial<PaymentAttribution> | null | undefined,
  fallback?: Partial<PaymentAttribution> | null
): PaymentAttribution {
  return {
    campaign_id: primary?.campaign_id ?? fallback?.campaign_id ?? null,
    category_id: primary?.category_id ?? fallback?.category_id ?? null,
    subcategory_id: primary?.subcategory_id ?? fallback?.subcategory_id ?? null,
    wishlist_item_id: primary?.wishlist_item_id ?? fallback?.wishlist_item_id ?? null,
  }
}

export function toPaymentAttributionColumns(attribution: PaymentAttribution) {
  return {
    campaign_id: attribution.campaign_id,
    category_id: attribution.category_id,
    subcategory_id: attribution.subcategory_id,
    wishlist_item_id: attribution.wishlist_item_id,
  }
}

export function hasAnyAttribution(attribution: PaymentAttribution): boolean {
  return Boolean(
    attribution.campaign_id || attribution.category_id || attribution.subcategory_id
  )
}

export type AttributionNameInput = {
  campaign?: string | null
  category?: string | null
  fund?: string | null
}

export type AttributionLookupMaps = {
  campaignsByName: Map<string, string>
  categoriesByName: Map<string, string>
  subcategoriesByName: Map<string, { id: string; category_id: string }>
}

function normalizeLookupName(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase()
}

export async function buildAttributionLookupMaps(
  supabase: SupabaseClient,
  organizationId: string
): Promise<AttributionLookupMaps> {
  const [campaignsResult, categoriesResult, subcategoriesResult] = await Promise.all([
    supabase.from("campaigns").select("id, name").eq("organization_id", organizationId),
    supabase.from("donation_categories").select("id, name").eq("organization_id", organizationId),
    supabase
      .from("donation_subcategories")
      .select("id, name, category_id")
      .eq("organization_id", organizationId),
  ])

  const campaignsByName = new Map<string, string>()
  for (const row of campaignsResult.data || []) {
    campaignsByName.set(normalizeLookupName(row.name), row.id as string)
  }

  const categoriesByName = new Map<string, string>()
  for (const row of categoriesResult.data || []) {
    categoriesByName.set(normalizeLookupName(row.name), row.id as string)
  }

  const subcategoriesByName = new Map<string, { id: string; category_id: string }>()
  for (const row of subcategoriesResult.data || []) {
    subcategoriesByName.set(normalizeLookupName(row.name), {
      id: row.id as string,
      category_id: row.category_id as string,
    })
  }

  return { campaignsByName, categoriesByName, subcategoriesByName }
}

export function resolveAttributionFromNames(
  input: AttributionNameInput,
  maps: AttributionLookupMaps
): PaymentAttribution {
  const campaign_id = input.campaign
    ? maps.campaignsByName.get(normalizeLookupName(input.campaign)) ?? null
    : null

  let category_id = input.category
    ? maps.categoriesByName.get(normalizeLookupName(input.category)) ?? null
    : null

  let subcategory_id: string | null = null
  if (input.fund) {
    const fund = maps.subcategoriesByName.get(normalizeLookupName(input.fund))
    if (fund) {
      subcategory_id = fund.id
      category_id = category_id ?? fund.category_id
    }
  }

  return { campaign_id, category_id, subcategory_id, wishlist_item_id: null }
}

export async function fetchPledgeAttribution(
  supabase: SupabaseClient,
  pledgeId: string
): Promise<PaymentAttribution> {
  const { data, error } = await supabase
    .from("pledges")
    .select("campaign_id, category_id, subcategory_id, wishlist_item_id")
    .eq("id", pledgeId)
    .maybeSingle()

  if (error || !data) return { ...EMPTY_PAYMENT_ATTRIBUTION }

  return {
    campaign_id: (data.campaign_id as string | null) ?? null,
    category_id: (data.category_id as string | null) ?? null,
    subcategory_id: (data.subcategory_id as string | null) ?? null,
    wishlist_item_id: (data.wishlist_item_id as string | null) ?? null,
  }
}

export async function fetchRecurringPlanAttribution(
  supabase: SupabaseClient,
  planId: string
): Promise<PaymentAttribution> {
  const { data, error } = await supabase
    .from("recurring_donation_plans")
    .select("campaign_id, category_id, subcategory_id, wishlist_item_id")
    .eq("id", planId)
    .maybeSingle()

  if (error || !data) return { ...EMPTY_PAYMENT_ATTRIBUTION }

  return {
    campaign_id: (data.campaign_id as string | null) ?? null,
    category_id: (data.category_id as string | null) ?? null,
    subcategory_id: (data.subcategory_id as string | null) ?? null,
    wishlist_item_id: (data.wishlist_item_id as string | null) ?? null,
  }
}

export function parseImportAttributionFromRawRow(
  rawRow: Record<string, unknown> | null | undefined
): AttributionNameInput {
  if (!rawRow) return {}

  const read = (...keys: string[]) => {
    for (const key of keys) {
      const value = rawRow[key]
      if (typeof value === "string" && value.trim()) return value.trim()
    }
    return null
  }

  return {
    campaign: read("campaign", "Campaign", "campaign_name", "Campaign Name"),
    category: read("category", "Category", "category_name", "Category Name"),
    fund: read("fund", "Fund", "subcategory", "Subcategory", "fund_name", "Fund Name"),
  }
}
