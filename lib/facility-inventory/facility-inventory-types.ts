export const FACILITY_INVENTORY_CATEGORIES = {
  furniture: "furniture",
  seating: "seating",
  cleaning: "cleaning",
  paperGoods: "paper_goods",
  equipment: "equipment",
  other: "other",
} as const

export type FacilityInventoryCategory =
  (typeof FACILITY_INVENTORY_CATEGORIES)[keyof typeof FACILITY_INVENTORY_CATEGORIES]

export const FACILITY_INVENTORY_CATEGORY_LABELS: Record<
  FacilityInventoryCategory,
  string
> = {
  furniture: "Furniture",
  seating: "Seating",
  cleaning: "Cleaning supplies",
  paper_goods: "Paper goods",
  equipment: "Equipment",
  other: "Other",
}

export const FACILITY_INVENTORY_CATEGORY_OPTIONS = (
  Object.keys(FACILITY_INVENTORY_CATEGORY_LABELS) as FacilityInventoryCategory[]
).map((value) => ({
  value,
  label: FACILITY_INVENTORY_CATEGORY_LABELS[value],
}))

export function normalizeFacilityInventoryCategory(
  value: string | null | undefined
): FacilityInventoryCategory {
  if (
    value === "furniture" ||
    value === "seating" ||
    value === "cleaning" ||
    value === "paper_goods" ||
    value === "equipment" ||
    value === "other"
  ) {
    return value
  }
  return "equipment"
}

export interface FacilityInventoryItem {
  id: string
  organization_id: string
  name: string
  slug: string
  category: FacilityInventoryCategory
  description: string | null
  size: string | null
  style: string | null
  color: string | null
  quantity: number
  location: string | null
  notes: string | null
  purchased_at: string | null
  unit_cost: number | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export function formatFacilityInventoryVariant(
  item: Pick<FacilityInventoryItem, "size" | "style" | "color">
) {
  return [item.size, item.style, item.color].filter(Boolean).join(" · ")
}

export function facilityInventoryLineTotal(
  item: Pick<FacilityInventoryItem, "quantity" | "unit_cost">
) {
  if (item.unit_cost == null || !Number.isFinite(item.unit_cost)) {
    return null
  }
  return item.quantity * item.unit_cost
}
