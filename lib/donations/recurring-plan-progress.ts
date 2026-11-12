import type { SupabaseClient } from "@supabase/supabase-js"

import { countsTowardGivingTotals, paymentNetAmount } from "@/lib/donations/payment-net-amount"
import {
  calculateNextPaymentDate,
  roundRecurringMoney,
} from "@/lib/donations/recurring-donation-schedule"
import type { RecurringFrequency } from "@/lib/donations/recurring-donation-types"

const PAID_ENOUGH = 0.009

export async function collectedTowardRecurringPlan(
  supabase: SupabaseClient,
  organizationId: string,
  planId: string
): Promise<number> {
  let total = 0
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from("payments")
      .select("amount, refunded_amount, status")
      .eq("organization_id", organizationId)
      .eq("recurring_donation_plan_id", planId)
      .range(from, from + 999)

    if (error) throw new Error(error.message)
    if (!data?.length) break

    for (const row of data) {
      if (!countsTowardGivingTotals(row)) continue
      total += paymentNetAmount(row.amount, row.refunded_amount)
    }

    if (data.length < 1000) break
    from += 1000
  }

  return roundRecurringMoney(total)
}

/** Null means the plan runs until someone cancels it. */
export async function recurringPlanAmountStillOwed(
  supabase: SupabaseClient,
  input: {
    organizationId: string
    planId: string
    goalAmount: number | null
    pledgeId: string | null
  }
): Promise<number | null> {
  if (input.pledgeId) {
    const { data, error } = await supabase
      .from("pledge_status_view")
      .select("balance_remaining")
      .eq("organization_id", input.organizationId)
      .eq("id", input.pledgeId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return roundRecurringMoney(Number(data?.balance_remaining ?? 0))
  }

  if (input.goalAmount != null && input.goalAmount > 0) {
    const collected = await collectedTowardRecurringPlan(
      supabase,
      input.organizationId,
      input.planId
    )
    return roundRecurringMoney(Math.max(input.goalAmount - collected, 0))
  }

  return null
}

export async function applyRecurringPlanAfterSuccessfulCharge(
  supabase: SupabaseClient,
  input: {
    organizationId: string
    planId: string
    frequency: RecurringFrequency
    currentNextDate: string
    currentStatus: string
    goalAmount: number | null
    pledgeId: string | null
    explicitNextDate?: string | null
  }
): Promise<{ completed: boolean; nextPaymentDate: string | null }> {
  const remaining = await recurringPlanAmountStillOwed(supabase, input)
  const completed = remaining != null && remaining <= PAID_ENOUGH

  if (completed) {
    const { error } = await supabase
      .from("recurring_donation_plans")
      .update({
        status: "completed",
        end_date: new Date().toISOString().slice(0, 10),
      })
      .eq("id", input.planId)
      .eq("organization_id", input.organizationId)
    if (error) throw new Error(error.message)
    return { completed: true, nextPaymentDate: null }
  }

  const nextPaymentDate =
    input.explicitNextDate ||
    calculateNextPaymentDate(input.currentNextDate, input.frequency)
  const status = input.currentStatus === "paused" ? "paused" : "active"
  const { error } = await supabase
    .from("recurring_donation_plans")
    .update({
      status,
      next_payment_date: nextPaymentDate,
    })
    .eq("id", input.planId)
    .eq("organization_id", input.organizationId)
  if (error) throw new Error(error.message)
  return { completed: false, nextPaymentDate }
}
