import type { SupabaseClient } from "@supabase/supabase-js"

export const GENERAL_DONATION_CATEGORY_NAME = "General Donation"

function normalizeName(value: string) {
  return value.trim().toLowerCase()
}

/**
 * Ensures category "General Donation" exists, then creates an open fund with
 * the given name under it (idempotent if a matching fund already exists).
 */
export async function ensureCampaignDonationFund(
  supabase: SupabaseClient,
  organizationId: string,
  campaignName: string
): Promise<
  | { success: true; categoryId: string; fundId: string; created: boolean }
  | { success: false; error: string }
> {
  const fundName = campaignName.trim()
  if (!fundName) {
    return { success: false, error: "Campaign name is required to create a fund." }
  }

  const { data: categories, error: categoriesError } = await supabase
    .from("donation_categories")
    .select("id, name")
    .eq("organization_id", organizationId)

  if (categoriesError) {
    return { success: false, error: categoriesError.message }
  }

  let categoryId =
    (categories ?? []).find(
      (row) => normalizeName(String(row.name ?? "")) === normalizeName(GENERAL_DONATION_CATEGORY_NAME)
    )?.id ?? null

  if (!categoryId) {
    const { data: createdCategory, error: createCategoryError } = await supabase
      .from("donation_categories")
      .insert({
        organization_id: organizationId,
        name: GENERAL_DONATION_CATEGORY_NAME,
        description: null,
        tax_deductible: true,
      })
      .select("id")
      .single()

    if (createCategoryError || !createdCategory) {
      return {
        success: false,
        error: createCategoryError?.message || "Could not create General Donation category.",
      }
    }

    categoryId = createdCategory.id as string
  }

  const { data: funds, error: fundsError } = await supabase
    .from("donation_subcategories")
    .select("id, name")
    .eq("organization_id", organizationId)
    .eq("category_id", categoryId)

  if (fundsError) {
    return { success: false, error: fundsError.message }
  }

  const existingFund = (funds ?? []).find(
    (row) => normalizeName(String(row.name ?? "")) === normalizeName(fundName)
  )

  if (existingFund) {
    return {
      success: true,
      categoryId,
      fundId: existingFund.id as string,
      created: false,
    }
  }

  const { data: createdFund, error: createFundError } = await supabase
    .from("donation_subcategories")
    .insert({
      organization_id: organizationId,
      category_id: categoryId,
      name: fundName,
      is_active: true,
    })
    .select("id")
    .single()

  if (createFundError || !createdFund) {
    return {
      success: false,
      error: createFundError?.message || "Could not create campaign fund.",
    }
  }

  return {
    success: true,
    categoryId,
    fundId: createdFund.id as string,
    created: true,
  }
}
