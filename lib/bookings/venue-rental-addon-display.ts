import type { RentalAddonCatalogItem } from "@/lib/bookings/venue-rental-types"

const PREFERRED_ADDON_SLUGS = new Set([
  "table-covers",
  "chair-covers",
  "plate-chargers",
  "gift-table-setup",
  "sound-system",
  "projector",
  "coffee",
])

function normalizeAddonNameKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    // Treat "Gift Table Setup" and "Gift Table" as the same catalog item.
    .replace(/\s+setup$/, "")
}

function preferredSlugScore(slug: string): number {
  return PREFERRED_ADDON_SLUGS.has(slug.trim().toLowerCase()) ? 0 : 1
}

/**
 * Collapse duplicate catalog rows (same display name / gift-table variants)
 * for customer-facing pickers. Prefers canonical slugs from Settings seeds.
 */
export function dedupeCustomerRentalAddons(
  rows: RentalAddonCatalogItem[]
): RentalAddonCatalogItem[] {
  const byKey = new Map<string, RentalAddonCatalogItem>()

  for (const row of rows) {
    const key = normalizeAddonNameKey(row.name)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, row)
      continue
    }

    const preferNew =
      preferredSlugScore(row.slug) < preferredSlugScore(existing.slug) ||
      (preferredSlugScore(row.slug) === preferredSlugScore(existing.slug) &&
        row.defaultPrice > existing.defaultPrice)

    if (preferNew) {
      byKey.set(key, row)
    }
  }

  return Array.from(byKey.values())
}

export function sortRentalAddonsAlphabetically(
  rows: RentalAddonCatalogItem[]
): RentalAddonCatalogItem[] {
  return [...rows].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  )
}
