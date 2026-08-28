export type TicketingEventCategory = {
  id: string
  organization_id: string
  name: string
  slug: string
  sort_order: number
  is_active: boolean
}

export const UNCATEGORIZED_TICKETING_CATEGORY_VALUE = "none"
