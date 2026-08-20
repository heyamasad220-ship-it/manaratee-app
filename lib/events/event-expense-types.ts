export const EVENT_EXPENSE_CATEGORIES = [
  "Venue",
  "Food/Catering",
  "Transportation",
  "Youth Activities",
  "Decor",
  "Printing",
  "Entertainment/Speakers",
  "Security",
  "Staff",
  "Equipment",
  "Marketing",
  "Other",
] as const

export type EventExpenseCategory = (typeof EVENT_EXPENSE_CATEGORIES)[number]

export type EventExpense = {
  id: string
  organization_id: string
  internal_event_id: string
  expense_date: string
  category: string
  payee: string | null
  description: string | null
  amount_cents: number
  currency: string
  is_paid: boolean
  payment_method: string | null
  reference: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type EventExpenseActionResult =
  | { success: true; expense?: EventExpense }
  | { success: false; error: string }

export function isExpenseCategory(value: string): value is EventExpenseCategory {
  return (EVENT_EXPENSE_CATEGORIES as readonly string[]).includes(value)
}
