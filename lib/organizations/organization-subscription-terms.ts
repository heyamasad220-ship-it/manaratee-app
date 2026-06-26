import { formatSubscriptionPrice } from "@/lib/organizations/organization-subscription-types"

export type OrganizationSubscriptionTerms = {
  subscriptionStartDate: string | null
  complimentaryMonths: number
  firstYearSpecialMonthlyRate: number | null
  paidBillingStartsDate: string | null
  firstYearEndsDate: string | null
  standardMonthlyRate: number
  currentEffectiveMonthlyRate: number
  isInComplimentaryPeriod: boolean
  isInFirstYearSpecialRatePeriod: boolean
  hasFirstYearSpecialRate: boolean
  billingPhaseLabel: string
  pricingNotes: string[]
}

export type OrganizationSubscriptionTermsInput = {
  subscriptionStartDate: string | null
  complimentaryMonths: number
  firstYearSpecialMonthlyRate: number | null
}

function parseDateParts(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number)
  return { year, month, day }
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addMonthsToDate(dateStr: string, months: number) {
  const { year, month, day } = parseDateParts(dateStr)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCMonth(date.getUTCMonth() + months)
  return formatDateOnly(date)
}

function addYearsToDate(dateStr: string, years: number) {
  const { year, month, day } = parseDateParts(dateStr)
  const date = new Date(Date.UTC(year + years, month - 1, day))
  return formatDateOnly(date)
}

function compareDateStrings(left: string, right: string) {
  return left.localeCompare(right)
}

export function todayDateString() {
  return formatDateOnly(new Date())
}

export function computeOrganizationSubscriptionTerms(
  input: OrganizationSubscriptionTermsInput,
  standardMonthlyRate: number,
  asOfDate: string = todayDateString()
): OrganizationSubscriptionTerms {
  const complimentaryMonths = Math.max(0, input.complimentaryMonths || 0)
  const firstYearSpecialMonthlyRate =
    input.firstYearSpecialMonthlyRate == null
      ? null
      : Number(input.firstYearSpecialMonthlyRate)
  const hasFirstYearSpecialRate =
    firstYearSpecialMonthlyRate != null && firstYearSpecialMonthlyRate >= 0

  const subscriptionStartDate = input.subscriptionStartDate
  const paidBillingStartsDate = subscriptionStartDate
    ? addMonthsToDate(subscriptionStartDate, complimentaryMonths)
    : null
  const firstYearEndsDate = subscriptionStartDate
    ? addYearsToDate(subscriptionStartDate, 1)
    : null

  const isInComplimentaryPeriod = Boolean(
    subscriptionStartDate &&
      paidBillingStartsDate &&
      compareDateStrings(asOfDate, paidBillingStartsDate) < 0
  )

  const isInFirstYearSpecialRatePeriod = Boolean(
    subscriptionStartDate &&
      firstYearEndsDate &&
      paidBillingStartsDate &&
      hasFirstYearSpecialRate &&
      compareDateStrings(asOfDate, paidBillingStartsDate) >= 0 &&
      compareDateStrings(asOfDate, firstYearEndsDate) < 0
  )

  let currentEffectiveMonthlyRate = standardMonthlyRate
  if (isInComplimentaryPeriod) {
    currentEffectiveMonthlyRate = 0
  } else if (isInFirstYearSpecialRatePeriod && firstYearSpecialMonthlyRate != null) {
    currentEffectiveMonthlyRate = firstYearSpecialMonthlyRate
  }

  let billingPhaseLabel = `${formatSubscriptionPrice(standardMonthlyRate)}/month`
  if (!subscriptionStartDate) {
    billingPhaseLabel = `${formatSubscriptionPrice(standardMonthlyRate)}/month`
  } else if (isInComplimentaryPeriod) {
    billingPhaseLabel = `$0/month until ${formatDisplayDate(paidBillingStartsDate!)}`
  } else if (isInFirstYearSpecialRatePeriod && firstYearSpecialMonthlyRate != null) {
    billingPhaseLabel = `${formatSubscriptionPrice(firstYearSpecialMonthlyRate)}/month first-year rate`
  }

  let pricingNotes: string[] = []

  if (subscriptionStartDate) {
    pricingNotes.push(
      `Subscription start date: ${formatDisplayDate(subscriptionStartDate)}.`
    )
  }

  if (subscriptionStartDate && complimentaryMonths > 0 && paidBillingStartsDate) {
    pricingNotes.push(
      complimentaryMonths === 1
        ? `Your first month is complimentary. Paid billing begins ${formatDisplayDate(paidBillingStartsDate)}.`
        : `Your first ${complimentaryMonths} months are complimentary. Paid billing begins ${formatDisplayDate(paidBillingStartsDate)}.`
    )
  }

  if (subscriptionStartDate && hasFirstYearSpecialRate && firstYearEndsDate) {
    const standardLabel = formatSubscriptionPrice(standardMonthlyRate)
    const specialLabel = formatSubscriptionPrice(firstYearSpecialMonthlyRate!)
    pricingNotes.push(
      `First-year special rate: ${specialLabel}/month through ${formatDisplayDate(firstYearEndsDate)}.`
    )
    pricingNotes.push(
      `After ${formatDisplayDate(firstYearEndsDate)}, the standard rate is ${standardLabel}/month unless otherwise agreed.`
    )
    pricingNotes.push(
      "Manaratee reserves the right to adjust subscription pricing after the first year."
    )
  } else if (subscriptionStartDate && standardMonthlyRate > 0) {
    pricingNotes.push(
      `Standard plan rate: ${formatSubscriptionPrice(standardMonthlyRate)}/month.`
    )
    pricingNotes.push(
      "Manaratee reserves the right to adjust subscription pricing in accordance with your agreement."
    )
  }

  const hasSubscriptionTermsConfigured = Boolean(
    subscriptionStartDate || complimentaryMonths > 0 || hasFirstYearSpecialRate
  )

  return {
    subscriptionStartDate,
    complimentaryMonths,
    firstYearSpecialMonthlyRate,
    paidBillingStartsDate,
    firstYearEndsDate,
    standardMonthlyRate,
    currentEffectiveMonthlyRate,
    isInComplimentaryPeriod,
    isInFirstYearSpecialRatePeriod,
    hasFirstYearSpecialRate,
    billingPhaseLabel,
    pricingNotes: hasSubscriptionTermsConfigured ? pricingNotes : [],
  }
}

export function formatDisplayDate(dateStr: string | null) {
  if (!dateStr) return "—"
  const { year, month, day } = parseDateParts(dateStr)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}
