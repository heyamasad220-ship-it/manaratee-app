import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import type { DiscountTag } from "@/lib/discount-tags/discount-tag-types"

function mapDiscountTagRow(row: Record<string, unknown>): DiscountTag {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    name: String(row.name || ""),
    description: (row.description as string | null) ?? null,
    active: Boolean(row.active),
    percent_off:
      row.percent_off === null || row.percent_off === undefined
        ? null
        : Number(row.percent_off),
    auto_apply: Boolean(row.auto_apply),
    applies_to_programs:
      row.applies_to_programs === undefined ? true : Boolean(row.applies_to_programs),
    applies_to_venue_rentals:
      row.applies_to_venue_rentals === undefined
        ? true
        : Boolean(row.applies_to_venue_rentals),
    applies_to_ticketing: Boolean(row.applies_to_ticketing),
    created_at: String(row.created_at || ""),
    updated_at: String(row.updated_at || ""),
  }
}

export async function getDiscountTags(): Promise<DiscountTag[]> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return []
  }

  const { data, error } = await supabase
    .from("discount_tags")
    .select("*")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true })

  if (error) {
    console.error(error)
    // Pre-migration schema may not include new columns — retry with core fields.
    if (
      error.message.toLowerCase().includes("percent_off") ||
      error.message.toLowerCase().includes("auto_apply")
    ) {
      const fallback = await supabase
        .from("discount_tags")
        .select("id, organization_id, name, description, active, created_at, updated_at")
        .eq("organization_id", organizationId)
        .order("name", { ascending: true })

      if (fallback.error) {
        throw new Error("Failed to load discount tags")
      }

      return (fallback.data || []).map((row) =>
        mapDiscountTagRow({
          ...row,
          percent_off: null,
          auto_apply: false,
          applies_to_programs: true,
          applies_to_venue_rentals: true,
          applies_to_ticketing: false,
        })
      )
    }

    throw new Error("Failed to load discount tags")
  }

  return (data || []).map((row) => mapDiscountTagRow(row as Record<string, unknown>))
}
