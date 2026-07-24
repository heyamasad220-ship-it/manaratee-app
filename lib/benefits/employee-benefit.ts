import { createClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { FULL_TIME_EMPLOYEE_DISCOUNT_TAG_NAME } from "@/lib/benefits/employee-benefit-constants"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { ensurePersonForContact } from "@/lib/people/person-tag-actions"

export { FULL_TIME_EMPLOYEE_DISCOUNT_TAG_NAME } from "@/lib/benefits/employee-benefit-constants"

export type OrganizationEmployeeBenefitPolicy = {
  organizationId: string
  enabled: boolean
  percentOff: number
  appliesToPrograms: boolean
  appliesToVenueRentals: boolean
  appliesToTicketing: boolean
  discountTagId: string | null
}

function normalizeTagName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

export async function getOrganizationEmployeeBenefitPolicy(
  organizationId?: string | null,
  supabaseClient?: SupabaseClient
): Promise<OrganizationEmployeeBenefitPolicy | null> {
  const supabase = supabaseClient ?? (await createClient())
  const orgId = organizationId ?? (await getSelectedOrganizationId())
  if (!orgId) return null

  const { data, error } = await supabase
    .from("organization_employee_benefits")
    .select(
      "organization_id, enabled, percent_off, applies_to_programs, applies_to_venue_rentals, applies_to_ticketing, discount_tag_id"
    )
    .eq("organization_id", orgId)
    .maybeSingle()

  if (error || !data) {
    // Policy table may not be migrated yet — default to 50% programs+venue.
    if (error?.message?.toLowerCase().includes("organization_employee_benefits")) {
      return {
        organizationId: orgId,
        enabled: true,
        percentOff: 50,
        appliesToPrograms: true,
        appliesToVenueRentals: true,
        appliesToTicketing: false,
        discountTagId: null,
      }
    }
    return null
  }

  return {
    organizationId: data.organization_id as string,
    enabled: Boolean(data.enabled),
    percentOff: Number(data.percent_off || 50),
    appliesToPrograms: Boolean(data.applies_to_programs),
    appliesToVenueRentals: Boolean(data.applies_to_venue_rentals),
    appliesToTicketing: Boolean(data.applies_to_ticketing),
    discountTagId: (data.discount_tag_id as string | null) || null,
  }
}

export async function contactIsActiveFullTimeEmployee(
  contactId: string | null | undefined,
  organizationId?: string | null,
  supabaseClient?: SupabaseClient
): Promise<boolean> {
  if (!contactId) return false
  const supabase = supabaseClient ?? (await createClient())
  const orgId = organizationId ?? (await getSelectedOrganizationId())
  if (!orgId) return false

  const { data, error } = await supabase
    .from("staff")
    .select("id")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .eq("status", "active")
    .eq("staff_type", "full_time")
    .limit(1)
    .maybeSingle()

  if (error) return false
  return Boolean(data?.id)
}

export async function ensureFullTimeEmployeeDiscountTag(
  organizationId: string,
  supabaseClient?: SupabaseClient
): Promise<string | null> {
  const supabase = supabaseClient ?? (await createClient())
  const target = normalizeTagName(FULL_TIME_EMPLOYEE_DISCOUNT_TAG_NAME)

  const { data: existing } = await supabase
    .from("discount_tags")
    .select("id, name")
    .eq("organization_id", organizationId)

  const match = (existing || []).find(
    (row) => normalizeTagName(String(row.name || "")) === target
  )
  if (match?.id) return match.id as string

  const { data: created, error } = await supabase
    .from("discount_tags")
    .insert({
      organization_id: organizationId,
      name: FULL_TIME_EMPLOYEE_DISCOUNT_TAG_NAME,
      description:
        "Automatic benefit for active full-time staff (programs and venue rentals).",
      active: true,
    })
    .select("id")
    .maybeSingle()

  if (error || !created) return null
  return created.id as string
}

/**
 * Keep the Full-Time Employee discount tag in sync with active FTE staff status.
 * Adds the tag when eligible; removes only this benefit tag when no longer eligible.
 */
export async function syncFullTimeEmployeeBenefitTag(
  contactId: string,
  organizationIdInput?: string | null,
  supabaseClient?: SupabaseClient
): Promise<void> {
  const supabase = supabaseClient ?? (await createClient())
  const organizationId =
    organizationIdInput ?? (await getSelectedOrganizationId())
  if (!organizationId || !contactId) return

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, person_id, contact_type")
    .eq("id", contactId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (!contact || contact.contact_type !== "individual") return

  const tagId = await ensureFullTimeEmployeeDiscountTag(organizationId, supabase)
  if (!tagId) return

  let personId = contact.person_id as string | null
  if (!personId) {
    personId = await ensurePersonForContact(contactId, organizationId)
  }
  if (!personId) return

  const isFte = await contactIsActiveFullTimeEmployee(
    contactId,
    organizationId,
    supabase
  )

  const { data: existing } = await supabase
    .from("person_tags")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("person_id", personId)
    .eq("tag_id", tagId)
    .maybeSingle()

  if (isFte && !existing) {
    await supabase.from("person_tags").insert({
      organization_id: organizationId,
      person_id: personId,
      tag_id: tagId,
    })
  }

  if (!isFte && existing) {
    await supabase
      .from("person_tags")
      .delete()
      .eq("id", existing.id)
      .eq("organization_id", organizationId)
  }

  try {
    const { data: policy } = await supabase
      .from("organization_employee_benefits")
      .select("organization_id")
      .eq("organization_id", organizationId)
      .maybeSingle()

    if (policy) {
      await supabase
        .from("organization_employee_benefits")
        .update({
          discount_tag_id: tagId,
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", organizationId)
    } else {
      await supabase.from("organization_employee_benefits").insert({
        organization_id: organizationId,
        enabled: true,
        percent_off: 50,
        applies_to_programs: true,
        applies_to_venue_rentals: true,
        applies_to_ticketing: false,
        discount_tag_id: tagId,
      })
    }
  } catch {
    // Policy table may not exist until migration 184 is applied.
  }
}

export function applyPercentOff(amount: number, percentOff: number) {
  const base = Math.max(0, Number(amount) || 0)
  const percent = Math.min(100, Math.max(0, Number(percentOff) || 0))
  const discount = Math.round(base * (percent / 100) * 100) / 100
  return {
    base,
    discount,
    total: Math.max(0, Math.round((base - discount) * 100) / 100),
  }
}
