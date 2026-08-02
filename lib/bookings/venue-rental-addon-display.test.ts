import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  dedupeCustomerRentalAddons,
  sortRentalAddonsAlphabetically,
} from "./venue-rental-addon-display"
import type { RentalAddonCatalogItem } from "./venue-rental-types"

function item(
  partial: Pick<RentalAddonCatalogItem, "id" | "name" | "slug"> &
    Partial<RentalAddonCatalogItem>
): RentalAddonCatalogItem {
  return {
    description: null,
    defaultPrice: 0,
    ...partial,
  }
}

describe("venue-rental-addon-display", () => {
  it("drops duplicate names and keeps preferred slug / gift-table-setup", () => {
    const rows = dedupeCustomerRentalAddons([
      item({ id: "1", name: "Chair Covers", slug: "chair-covers-legacy", defaultPrice: 1 }),
      item({ id: "2", name: "Chair Covers", slug: "chair-covers", defaultPrice: 2 }),
      item({ id: "4", name: "Gift Table", slug: "gift-table", defaultPrice: 50 }),
      item({ id: "5", name: "Gift Table Setup", slug: "gift-table-setup", defaultPrice: 50 }),
      item({ id: "6", name: "Coffee", slug: "coffee", defaultPrice: 0 }),
    ])

    assert.deepEqual(
      rows.map((r) => r.slug).sort(),
      ["chair-covers", "coffee", "gift-table-setup"]
    )
  })

  it("sorts add-ons alphabetically by name", () => {
    const sorted = sortRentalAddonsAlphabetically([
      item({ id: "a", name: "Sound System", slug: "sound" }),
      item({ id: "b", name: "Coffee", slug: "coffee" }),
      item({ id: "c", name: "Plate Chargers", slug: "plates" }),
    ])
    assert.deepEqual(
      sorted.map((r) => r.name),
      ["Coffee", "Plate Chargers", "Sound System"]
    )
  })
})
