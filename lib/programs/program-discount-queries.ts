import { createClient } from "@/lib/supabase/server"

export async function getActiveDiscountTags() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("discount_tags")
    .select("id, name")
    .eq("active", true)
    .order("name")

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function getProgramDiscounts(programId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("program_discounts")
    .select("id, discount_tag_id, discount_type, amount, is_active")
    .eq("program_id", programId)
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)

  return data
}