import type { ProgramRegistrationQuote } from "@/lib/programs/program-quote-types"

export function mergeRegistrationQuotes(
  quotes: ProgramRegistrationQuote[]
): ProgramRegistrationQuote | null {
  if (quotes.length === 0) return null

  const currency = quotes[0]?.currency || "USD"
  const lineItems = quotes.flatMap((quote) => quote.line_items)
  const discounts = quotes.flatMap((quote) => quote.discounts)
  const scheduledPayments = quotes.flatMap((quote) => quote.scheduled_payments)

  const subtotal = quotes.reduce((sum, quote) => sum + Number(quote.subtotal || 0), 0)
  const discountTotal = quotes.reduce(
    (sum, quote) => sum + Number(quote.discount_total || 0),
    0
  )
  const total = quotes.reduce((sum, quote) => sum + Number(quote.total || 0), 0)
  const dueToday = quotes.reduce((sum, quote) => sum + Number(quote.due_today || 0), 0)

  return {
    ok: true,
    currency,
    fee_plan_id: quotes[0].fee_plan_id,
    plan_type: quotes[0].plan_type,
    line_items: lineItems,
    subtotal,
    discounts,
    discount_total: discountTotal,
    total,
    due_today: dueToday,
    scheduled_payments: scheduledPayments,
  }
}
