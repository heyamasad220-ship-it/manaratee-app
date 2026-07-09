import type { SupabaseClient } from "@supabase/supabase-js"

export function isDonationFundActive(isActive: boolean | null | undefined): boolean {
  return isActive !== false
}

export async function validateOpenDonationFund(
  supabase: SupabaseClient,
  organizationId: string,
  subcategoryId: string | null | undefined
): Promise<
  { ok: true; categoryId: string } | { ok: false; error: string } | { ok: true; categoryId?: undefined }
> {
  if (!subcategoryId) {
    return { ok: true }
  }

  const { data, error } = await supabase
    .from("donation_subcategories")
    .select("is_active, category_id")
    .eq("id", subcategoryId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error || !data) {
    return { ok: false, error: "Fund not found." }
  }

  if (!isDonationFundActive(data.is_active as boolean | null)) {
    return { ok: false, error: "This fund is closed and cannot accept new gifts." }
  }

  return { ok: true, categoryId: data.category_id as string }
}

export async function validateCustomerDonationAttribution(
  supabase: SupabaseClient,
  organizationId: string,
  input: {
    categoryId?: string | null
    subcategoryId?: string | null
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const categoryId = input.categoryId?.trim() || null
  const subcategoryId = input.subcategoryId?.trim() || null

  if (subcategoryId) {
    const fundCheck = await validateOpenDonationFund(supabase, organizationId, subcategoryId)
    if (!fundCheck.ok) {
      return fundCheck
    }

    if (categoryId && "categoryId" in fundCheck && fundCheck.categoryId !== categoryId) {
      return { ok: false, error: "Selected fund does not match the chosen category." }
    }

    return { ok: true }
  }

  if (!categoryId) {
    return { ok: true }
  }

  const { count, error } = await supabase
    .from("donation_subcategories")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("category_id", categoryId)
    .eq("is_active", true)

  if (error) {
    return { ok: false, error: error.message }
  }

  if ((count || 0) > 0) {
    return { ok: false, error: "Please select an open fund for this category." }
  }

  return { ok: true }
}
