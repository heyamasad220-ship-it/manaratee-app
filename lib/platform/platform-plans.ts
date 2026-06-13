import type { SupabaseClient } from "@supabase/supabase-js"

export type PlatformPlanRecord = {
  id: string
  name: string
  slug: string
  description: string | null
  monthly_price: number
  yearly_price: number
  member_limit: number | null
  event_limit: number | null
  is_popular: boolean
  is_active: boolean
  modules: string[]
}

export async function listPlatformPlans(
  admin: SupabaseClient
): Promise<PlatformPlanRecord[]> {
  const { data, error } = await admin
    .from("plans")
    .select(`
      id,
      name,
      slug,
      description,
      monthly_price,
      yearly_price,
      member_limit,
      event_limit,
      is_popular,
      is_active,
      plan_modules (
        module_id,
        modules (
          slug
        )
      )
    `)
    .eq("is_active", true)
    .order("monthly_price", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data || []).map((plan) => ({
    id: plan.id as string,
    name: plan.name as string,
    slug: plan.slug as string,
    description: (plan.description as string | null) ?? null,
    monthly_price: Number(plan.monthly_price || 0),
    yearly_price: Number(plan.yearly_price || 0),
    member_limit: (plan.member_limit as number | null) ?? null,
    event_limit: (plan.event_limit as number | null) ?? null,
    is_popular: Boolean(plan.is_popular),
    is_active: Boolean(plan.is_active),
    modules:
      (plan.plan_modules as Array<{ modules?: { slug?: string } | null }> | null)
        ?.map((row) => row.modules?.slug)
        .filter(Boolean) ?? [],
  }))
}

export async function listActiveModules(admin: SupabaseClient) {
  const { data, error } = await admin
    .from("modules")
    .select("id, name, slug")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data || []
}

export async function updatePlatformPlan(input: {
  admin: SupabaseClient
  planId: string
  name: string
  description: string | null
  monthlyPrice: number
  yearlyPrice: number
  memberLimit: number | null
  eventLimit: number | null
  isPopular: boolean
  moduleSlugs: string[]
}) {
  const { error: planError } = await input.admin
    .from("plans")
    .update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      monthly_price: input.monthlyPrice,
      yearly_price: input.yearlyPrice,
      member_limit: input.memberLimit,
      event_limit: input.eventLimit,
      is_popular: input.isPopular,
    })
    .eq("id", input.planId)

  if (planError) {
    throw new Error(planError.message)
  }

  const { error: deleteError } = await input.admin
    .from("plan_modules")
    .delete()
    .eq("plan_id", input.planId)

  if (deleteError) {
    throw new Error(`Could not update plan modules: ${deleteError.message}`)
  }

  if (input.moduleSlugs.length === 0) {
    return
  }

  const { data: modules, error: modulesError } = await input.admin
    .from("modules")
    .select("id, slug")
    .in("slug", input.moduleSlugs)

  if (modulesError) {
    throw new Error(modulesError.message)
  }

  const moduleIds = (modules || []).map((row) => row.id as string)

  if (moduleIds.length === 0) {
    return
  }

  const rows = moduleIds.map((moduleId) => ({
    plan_id: input.planId,
    module_id: moduleId,
  }))

  const { error: insertError } = await input.admin.from("plan_modules").insert(rows)

  if (insertError) {
    throw new Error(`Could not save selected tools: ${insertError.message}`)
  }
}

export async function createPlatformPlan(input: {
  admin: SupabaseClient
  name: string
  monthlyPrice: number
  memberLimit: number | null
}) {
  const slug = input.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

  const { error } = await input.admin.from("plans").insert({
    code: slug,
    name: input.name.trim(),
    slug,
    description: `${input.name.trim()} plan`,
    monthly_price: input.monthlyPrice,
    yearly_price: input.monthlyPrice * 10,
    member_limit: input.memberLimit,
    event_limit: null,
    is_active: true,
    is_public: true,
    is_popular: false,
  })

  if (error) {
    throw new Error(error.message)
  }
}
