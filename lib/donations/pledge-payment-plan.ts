import { calculateNextPaymentDate } from "@/lib/donations/recurring-donation-schedule"
import type { RecurringFrequency } from "@/lib/donations/recurring-donation-types"

export type PledgePlanFrequency = "one_time" | "monthly" | "quarterly" | "annually"

const INSTALLMENT_FREQUENCIES = new Set<PledgePlanFrequency>([
  "monthly",
  "quarterly",
  "annually",
])

export function normalizePledgePlanFrequency(
  frequency: string | null | undefined
): PledgePlanFrequency {
  const normalized = String(frequency || "one_time")
    .toLowerCase()
    .replace(/-/g, "_")
    .trim()

  if (normalized === "one-time" || normalized === "onetime") return "one_time"
  if (normalized === "annual" || normalized === "yearly") return "annually"
  if (INSTALLMENT_FREQUENCIES.has(normalized as PledgePlanFrequency)) {
    return normalized as PledgePlanFrequency
  }
  return "one_time"
}

export function formatPledgePlanFrequencyLabel(frequency: string | null | undefined): string {
  switch (normalizePledgePlanFrequency(frequency)) {
    case "monthly":
      return "Monthly"
    case "quarterly":
      return "Quarterly"
    case "annually":
      return "Annually"
    default:
      return "One-time"
  }
}

export function isInstallmentPledgePlan(frequency: string | null | undefined): boolean {
  return INSTALLMENT_FREQUENCIES.has(normalizePledgePlanFrequency(frequency))
}

export function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100
}

export function calculateInstallmentAmount(totalAmount: number, numberOfPayments: number): number {
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) return 0
  if (!Number.isFinite(numberOfPayments) || numberOfPayments <= 0) return totalAmount
  return roundCurrency(totalAmount / numberOfPayments)
}

export function addMonthsToDateOnly(baseDate: string, months: number): string {
  const [year, month, day] = baseDate.split("-").map(Number)
  const date = new Date(year, month - 1 + months, day)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function defaultFirstPaymentDate(monthsAhead = 1): string {
  const today = new Date()
  const target = new Date(today.getFullYear(), today.getMonth() + monthsAhead, today.getDate())
  const y = target.getFullYear()
  const m = String(target.getMonth() + 1).padStart(2, "0")
  const d = String(target.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function computeScheduledPledgePaymentDate(input: {
  firstPaymentDate: string | null | undefined
  frequency: string | null | undefined
  paymentsMade: number
}): string | null {
  const firstDate = input.firstPaymentDate?.trim()
  if (!firstDate) return null

  const frequency = normalizePledgePlanFrequency(input.frequency)
  if (frequency === "one_time") return firstDate

  let cursor = firstDate
  for (let index = 0; index < input.paymentsMade; index += 1) {
    cursor = calculateNextPaymentDate(cursor, frequency as RecurringFrequency)
  }
  return cursor
}

const MAX_INSTALLMENTS = 600

export function lastPaymentDateFromCount(
  firstPaymentDate: string,
  frequency: string,
  totalPayments: number
): string | null {
  if (!firstPaymentDate.trim() || totalPayments < 1) return null
  return computeScheduledPledgePaymentDate({
    firstPaymentDate,
    frequency,
    paymentsMade: totalPayments - 1,
  })
}

export function paymentCountFromLastDate(
  firstPaymentDate: string,
  frequency: string,
  lastPaymentDate: string
): number {
  const first = firstPaymentDate.trim()
  const last = lastPaymentDate.trim()
  if (!first || !last || last < first) return 0
  if (last === first) return 1

  const planFrequency = normalizePledgePlanFrequency(frequency)
  if (planFrequency === "one_time") return 1

  let count = 1
  let cursor = first
  while (count < MAX_INSTALLMENTS) {
    const next = calculateNextPaymentDate(cursor, planFrequency as RecurringFrequency)
    if (next > last) break
    cursor = next
    count += 1
  }
  return count
}

export type PledgePlanWriteFields = {
  frequency: PledgePlanFrequency
  pledge_type: PledgePlanFrequency
  installment_amount: number | null
  total_payments: number | null
  first_payment_date: string | null
  next_payment_date: string | null
}

export function buildPledgePlanWriteFields(input: {
  frequency: string
  amountPledged: number
  firstPaymentDate?: string | null
  numberOfPayments?: number | null
  endDate?: string | null
}): { ok: true; fields: PledgePlanWriteFields } | { ok: false; error: string } {
  const frequency = normalizePledgePlanFrequency(input.frequency)
  const amount = Number(input.amountPledged)

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Amount must be greater than zero." }
  }

  if (!isInstallmentPledgePlan(frequency)) {
    return {
      ok: true,
      fields: {
        frequency: "one_time",
        pledge_type: "one_time",
        installment_amount: null,
        total_payments: null,
        first_payment_date: null,
        next_payment_date: null,
      },
    }
  }

  const firstPaymentDate = input.firstPaymentDate?.trim() || ""
  if (!firstPaymentDate) {
    return { ok: false, error: "Choose a first payment date." }
  }

  const countFromInput = Number(input.numberOfPayments)
  const hasCount = Number.isInteger(countFromInput) && countFromInput >= 2
  const endDate = input.endDate?.trim() || ""

  let totalPayments = 0
  if (hasCount) {
    totalPayments = countFromInput
  } else if (endDate) {
    totalPayments = paymentCountFromLastDate(firstPaymentDate, frequency, endDate)
    if (totalPayments < 2) {
      return {
        ok: false,
        error: "End date must be on or after the second payment.",
      }
    }
  } else {
    return {
      ok: false,
      error: "Enter the number of installments or an end date.",
    }
  }

  const installmentAmount = calculateInstallmentAmount(amount, totalPayments)
  return {
    ok: true,
    fields: {
      frequency,
      pledge_type: frequency,
      installment_amount: installmentAmount,
      total_payments: totalPayments,
      first_payment_date: firstPaymentDate,
      next_payment_date: firstPaymentDate,
    },
  }
}

export function formatPledgePaymentPlanSummary(input: {
  totalAmount: number
  installmentAmount: number | null
  totalPayments: number | null
  frequency: string | null | undefined
}): string {
  if (!pledgeHasPaymentPlan(input)) {
    return "No payment plan yet"
  }

  const frequency = normalizePledgePlanFrequency(input.frequency)
  const totalPayments = input.totalPayments ?? 1

  if (frequency === "one_time" || totalPayments <= 1) {
    return "Pay in full"
  }

  const installment = input.installmentAmount ?? calculateInstallmentAmount(input.totalAmount, totalPayments)
  return `${formatPledgePlanFrequencyLabel(frequency)} · ${formatMoney(installment)} × ${totalPayments} payments`
}

export function suggestedPledgePaymentAmount(input: {
  balance: number
  installmentAmount: number | null
  frequency: string | null | undefined
  totalPayments?: number | null
}): number {
  if (input.balance <= 0) return 0
  if (!pledgeHasPaymentPlan(input)) return input.balance
  if (input.installmentAmount && input.installmentAmount > 0) {
    return roundCurrency(Math.min(input.installmentAmount, input.balance))
  }
  return input.balance
}

export function pledgeHasPaymentPlan(input: {
  frequency: string | null | undefined
  totalPayments?: number | null
  installmentAmount?: number | null
}): boolean {
  if (!isInstallmentPledgePlan(input.frequency)) return false
  return (input.totalPayments ?? 0) > 1
}

export type PledgePaymentPlanInput = {
  installmentAmount: number
  numberOfPayments: number
  frequency: string
  firstPaymentDate: string
}

export type ValidatedPledgePaymentPlan = {
  installmentAmount: number
  totalPayments: number
  frequency: PledgePlanFrequency
  firstPaymentDate: string
}

export function validatePledgePaymentPlanInput(
  totalAmount: number,
  input: PledgePaymentPlanInput
): { ok: true; plan: ValidatedPledgePaymentPlan } | { ok: false; error: string } {
  const frequency = normalizePledgePlanFrequency(input.frequency)

  if (!isInstallmentPledgePlan(frequency)) {
    return { ok: false, error: "Choose a valid payment frequency." }
  }

  const totalPayments = Number(input.numberOfPayments)
  if (!Number.isInteger(totalPayments) || totalPayments < 2) {
    return { ok: false, error: "Enter at least 2 payments." }
  }

  let installmentAmount = roundCurrency(Number(input.installmentAmount))
  if (!Number.isFinite(installmentAmount) || installmentAmount <= 0) {
    installmentAmount = calculateInstallmentAmount(totalAmount, totalPayments)
  }

  const plannedTotal = roundCurrency(installmentAmount * totalPayments)
  if (Math.abs(plannedTotal - totalAmount) > 0.05) {
    return {
      ok: false,
      error: "Payment amount × number of payments must equal the total pledge.",
    }
  }

  const firstPaymentDate = input.firstPaymentDate?.trim()
  if (!firstPaymentDate) {
    return { ok: false, error: "Choose a first payment date." }
  }

  return {
    ok: true,
    plan: {
      installmentAmount,
      totalPayments,
      frequency,
      firstPaymentDate,
    },
  }
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}
