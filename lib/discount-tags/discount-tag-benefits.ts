import type { SupabaseClient } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import type { DiscountTagModule } from "@/lib/discount-tags/discount-tag-types"

export type ContactAutoApplyTagDiscount = {
  percentOff: number
  tagId: string
  tagName: string
}

/**
 * Best auto-apply discount tag for a contact on a given module.
 * Requires migration 202 (contact_best_auto_apply_tag_discount).
 */
export async function getContactBestAutoApplyTagDiscount(
  contactId: string | null | undefined,
  module: DiscountTagModule,
  organizationId?: string | null,
  supabaseClient?: SupabaseClient
): Promise<ContactAutoApplyTagDiscount | null> {
  if (!contactId) return null

  const supabase = supabaseClient ?? (await createClient())
  const orgId = organizationId ?? (await getSelectedOrganizationId())
  if (!orgId) return null

  const { data, error } = await supabase.rpc(
    "contact_best_auto_apply_tag_discount",
    {
      p_organization_id: orgId,
      p_contact_id: contactId,
      p_module: module,
    }
  )

  if (error) {
    // Migration not applied yet — fall back to direct query.
    if (
      error.message?.toLowerCase().includes("contact_best_auto_apply_tag_discount") ||
      error.message?.toLowerCase().includes("percent_off") ||
      error.message?.toLowerCase().includes("auto_apply")
    ) {
      return getContactBestAutoApplyTagDiscountFallback(
        contactId,
        module,
        orgId,
        supabase
      )
    }
    console.warn("auto-apply tag discount lookup failed:", error.message)
    return null
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row?.percent_off || !row?.tag_id) return null

  return {
    percentOff: Number(row.percent_off),
    tagId: row.tag_id as string,
    tagName: String(row.tag_name || "Discount tag"),
  }
}

async function getContactBestAutoApplyTagDiscountFallback(
  contactId: string,
  module: DiscountTagModule,
  organizationId: string,
  supabase: SupabaseClient
): Promise<ContactAutoApplyTagDiscount | null> {
  const { data: contact } = await supabase
    .from("contacts")
    .select("person_id")
    .eq("id", contactId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (!contact?.person_id) return null

  const { data: personTags, error } = await supabase
    .from("person_tags")
    .select(
      "tag_id, discount_tags:tag_id ( id, name, percent_off, auto_apply, active, applies_to_programs, applies_to_venue_rentals, applies_to_ticketing )"
    )
    .eq("organization_id", organizationId)
    .eq("person_id", contact.person_id)

  if (error || !personTags) return null

  const candidates: ContactAutoApplyTagDiscount[] = []
  for (const row of personTags) {
    const tagRel = row.discount_tags as
      | {
          id?: string
          name?: string
          percent_off?: number | null
          auto_apply?: boolean
          active?: boolean
          applies_to_programs?: boolean
          applies_to_venue_rentals?: boolean
          applies_to_ticketing?: boolean
        }
      | {
          id?: string
          name?: string
          percent_off?: number | null
          auto_apply?: boolean
          active?: boolean
          applies_to_programs?: boolean
          applies_to_venue_rentals?: boolean
          applies_to_ticketing?: boolean
        }[]
      | null
    const tag = Array.isArray(tagRel) ? tagRel[0] : tagRel
    if (!tag?.id || !tag.active || !tag.auto_apply) continue
    const percent = Number(tag.percent_off || 0)
    if (!(percent > 0)) continue

    const moduleOk =
      (module === "programs" && tag.applies_to_programs) ||
      (module === "venue_rentals" && tag.applies_to_venue_rentals) ||
      (module === "ticketing" && tag.applies_to_ticketing)
    if (!moduleOk) continue

    candidates.push({
      percentOff: percent,
      tagId: tag.id,
      tagName: tag.name || "Discount tag",
    })
  }

  if (candidates.length === 0) return null
  candidates.sort((a, b) => b.percentOff - a.percentOff)
  return candidates[0]
}
