export type QuoteLineItem = {
  component_type: string
  label: string
  quantity: number
  unit_amount: number
  amount: number
}

export type QuoteDiscount = {
  rule_type: string
  label: string
  amount: number
}

export type QuoteScheduledPayment = {
  label: string
  due_date: string
  amount: number
}

export function mapQuoteErrorMessage(message: string): string {
  const normalized = message || ""

  if (normalized.includes("quote:no-fee-plan")) {
    return "This program does not have a fee plan configured."
  }

  if (normalized.includes("quote:invalid-fee-plan")) {
    return "This registration option references an invalid fee plan."
  }

  if (normalized.includes("quote:invalid-lunch")) {
    return "The selected lunch option could not be found."
  }

  if (
    normalized.includes("quote:invalid-session") ||
    normalized.includes("quote:invalid-option") ||
    normalized.includes("quote:invalid-offering")
  ) {
    return "One or more selected options could not be found."
  }

  if (
    normalized.includes("quote:pricing-error") ||
    normalized.includes("quote:failed")
  ) {
    return "We could not calculate pricing for this registration."
  }

  if (normalized.includes("quote:unauthorized")) {
    return "You are not authorized to view pricing for this program."
  }

  return "Could not calculate quote. Please check your selections."
}

export type ProgramRegistrationQuote = {
  ok: boolean
  currency: string
  fee_plan_id: string
  plan_type: string
  registration_option_id?: string
  resolved_session_ids?: string[]
  line_items: QuoteLineItem[]
  subtotal: number
  discounts: QuoteDiscount[]
  discount_total: number
  total: number
  due_today: number
  scheduled_payments: QuoteScheduledPayment[]
}

export type QuoteAddons = {
  before_care?: boolean
  after_care?: boolean
  lunch_option_id?: string | null
}
