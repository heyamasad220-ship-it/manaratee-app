export const EMPTY_PAYMENT_ATTRIBUTION = {
  campaign_id: null,
  category_id: null,
  subcategory_id: null,
}

export function mergePaymentAttribution(primary, fallback) {
  return {
    campaign_id: primary?.campaign_id ?? fallback?.campaign_id ?? null,
    category_id: primary?.category_id ?? fallback?.category_id ?? null,
    subcategory_id: primary?.subcategory_id ?? fallback?.subcategory_id ?? null,
  }
}

export function hasAnyAttribution(attribution) {
  return Boolean(
    attribution.campaign_id || attribution.category_id || attribution.subcategory_id
  )
}

function normalizeLookupName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
}

export async function buildAttributionLookupMaps(sb, organizationId) {
  const [campaignsResult, categoriesResult, subcategoriesResult] = await Promise.all([
    sb.from("campaigns").select("id, name").eq("organization_id", organizationId),
    sb.from("donation_categories").select("id, name").eq("organization_id", organizationId),
    sb
      .from("donation_subcategories")
      .select("id, name, category_id")
      .eq("organization_id", organizationId),
  ])

  const campaignsByName = new Map()
  for (const row of campaignsResult.data || []) {
    campaignsByName.set(normalizeLookupName(row.name), row.id)
  }

  const categoriesByName = new Map()
  for (const row of categoriesResult.data || []) {
    categoriesByName.set(normalizeLookupName(row.name), row.id)
  }

  const subcategoriesByName = new Map()
  for (const row of subcategoriesResult.data || []) {
    subcategoriesByName.set(normalizeLookupName(row.name), {
      id: row.id,
      category_id: row.category_id,
    })
  }

  return { campaignsByName, categoriesByName, subcategoriesByName }
}

export function resolveAttributionFromNames(input, maps) {
  const campaign_id = input.campaign
    ? maps.campaignsByName.get(normalizeLookupName(input.campaign)) ?? null
    : null

  let category_id = input.category
    ? maps.categoriesByName.get(normalizeLookupName(input.category)) ?? null
    : null

  let subcategory_id = null
  if (input.fund) {
    const fund = maps.subcategoriesByName.get(normalizeLookupName(input.fund))
    if (fund) {
      subcategory_id = fund.id
      category_id = category_id ?? fund.category_id
    }
  }

  return { campaign_id, category_id, subcategory_id }
}

export function parseImportAttributionFromRawRow(rawRow) {
  if (!rawRow || typeof rawRow !== "object") return {}

  const read = (...keys) => {
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

export function paymentHasDirectAttribution(payment) {
  return Boolean(payment.campaign_id || payment.category_id || payment.subcategory_id)
}

export function paymentHasResolvableAttribution(payment, pledgeById) {
  if (paymentHasDirectAttribution(payment)) return true
  if (!payment.pledge_id) return false
  const pledge = pledgeById.get(payment.pledge_id)
  if (!pledge) return false
  return Boolean(pledge.campaign_id || pledge.category_id || pledge.subcategory_id)
}
