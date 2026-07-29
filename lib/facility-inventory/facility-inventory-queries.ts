import { createClient } from "@/lib/supabase/server"
import { resolveOrganizationId } from "@/lib/organizations/resolve-organization-id"

import {
  normalizeFacilityInventoryCategory,
  type FacilityInventoryItem,
} from "./facility-inventory-types"

function mapInventoryRow(row: Record<string, unknown>): FacilityInventoryItem {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    name: row.name as string,
    slug: row.slug as string,
    category: normalizeFacilityInventoryCategory(row.category as string | null),
    description: (row.description as string | null) ?? null,
    size: (row.size as string | null) ?? null,
    style: (row.style as string | null) ?? null,
    color: (row.color as string | null) ?? null,
    quantity: Number(row.quantity ?? 0),
    location: (row.location as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    purchased_at: (row.purchased_at as string | null) ?? null,
    unit_cost:
      row.unit_cost == null || row.unit_cost === ""
        ? null
        : Number(row.unit_cost),
    is_active: Boolean(row.is_active),
    sort_order: Number(row.sort_order ?? 0),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

export async function getFacilityInventoryItems(options?: {
  activeOnly?: boolean
  category?: string
}) {
  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    return []
  }

  let query = supabase
    .from("facility_inventory_items")
    .select("*")
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  if (options?.activeOnly) {
    query = query.eq("is_active", true)
  }

  if (options?.category && options.category !== "all") {
    query = query.eq("category", normalizeFacilityInventoryCategory(options.category))
  }

  const { data, error } = await query

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST204") {
      return []
    }
    // Pre-migration 208: category column missing — fall back to base select.
    if (
      error.message?.includes("category") ||
      error.message?.includes("unit_cost") ||
      error.code === "42703"
    ) {
      const fallback = await supabase
        .from("facility_inventory_items")
        .select("*")
        .eq("organization_id", organizationId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true })

      if (fallback.error) {
        console.error(fallback.error)
        throw new Error("Failed to load facility inventory")
      }

      return (fallback.data || []).map((row) =>
        mapInventoryRow(row as Record<string, unknown>)
      )
    }
    console.error(error)
    throw new Error("Failed to load facility inventory")
  }

  return (data || []).map((row) => mapInventoryRow(row as Record<string, unknown>))
}
