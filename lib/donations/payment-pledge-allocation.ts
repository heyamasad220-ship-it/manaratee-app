export type PledgeAllocationCandidate = {
  id: string
  donorId: string | null
  balanceRemaining: number
  frequency: string | null
  pledgeType: string | null
}

const INSTALLMENT_FREQUENCIES = new Set([
  "monthly",
  "quarterly",
  "yearly",
  "weekly",
  "annually",
  "annual",
])

export function normalizePledgeFrequency(frequency: string | null | undefined): string {
  return String(frequency || "one_time")
    .toLowerCase()
    .replace(/-/g, "_")
    .trim()
}

export function isLumpSumPledge(frequency: string | null | undefined): boolean {
  const normalized = normalizePledgeFrequency(frequency)
  return normalized === "one_time" || normalized === "onetime" || normalized === ""
}

export function isInstallmentPledge(frequency: string | null | undefined): boolean {
  return INSTALLMENT_FREQUENCIES.has(normalizePledgeFrequency(frequency))
}

/**
 * Pick the best open pledge for an ad-hoc imported payment.
 * Prefers lump-sum (one-time) pledges over installment schedules, especially when
 * the donor has an active recurring collection plan.
 */
export function pickPledgeForImportAllocation(
  pledges: PledgeAllocationCandidate[],
  options: { donorHasActiveRecurringPlan?: boolean } = {}
): PledgeAllocationCandidate | null {
  const open = pledges.filter((pledge) => pledge.balanceRemaining > 0)
  if (open.length === 0) return null

  const lumpSum = open.filter((pledge) => isLumpSumPledge(pledge.frequency))
  let pool = lumpSum

  if (pool.length === 0 && !options.donorHasActiveRecurringPlan) {
    pool = open.filter((pledge) => isInstallmentPledge(pledge.frequency))
  }

  if (pool.length === 0) {
    pool = open
  }

  pool.sort((a, b) => b.balanceRemaining - a.balanceRemaining)

  const top = pool[0]
  if (!top) return null

  const tied = pool.filter((pledge) => pledge.balanceRemaining === top.balanceRemaining)
  if (tied.length > 1) return null

  return top
}
