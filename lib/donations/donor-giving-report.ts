export type DonorDateRangeMode = "lifetime" | "year" | "custom"

export type DonorTypeFilter = "all" | "individual" | "organization"

export type DonorReportSortBy =
  | "full_name"
  | "total_donations"
  | "last_donation_date"
  | "outstanding_pledge_balance"

export type DonorReportDateInput = {
  dateRangeMode: DonorDateRangeMode
  taxYear?: number
  dateFrom?: string
  dateTo?: string
}

export function resolveDonorReportDateRange(input: DonorReportDateInput): {
  dateFrom?: string
  dateTo?: string
} {
  if (input.dateRangeMode === "lifetime") {
    return {}
  }

  if (input.dateRangeMode === "year" && input.taxYear) {
    return {
      dateFrom: `${input.taxYear}-01-01`,
      dateTo: `${input.taxYear}-12-31`,
    }
  }

  if (input.dateRangeMode === "custom") {
    return {
      dateFrom: input.dateFrom || undefined,
      dateTo: input.dateTo || undefined,
    }
  }

  return {}
}

export function formatDonorReportPeriodLabel(input: DonorReportDateInput): string {
  if (input.dateRangeMode === "lifetime") {
    return "Lifetime giving"
  }

  if (input.dateRangeMode === "year" && input.taxYear) {
    return `Gifts in ${input.taxYear}`
  }

  if (input.dateRangeMode === "custom") {
    const from = input.dateFrom ? formatShortDate(input.dateFrom) : "…"
    const to = input.dateTo ? formatShortDate(input.dateTo) : "…"
    return `Gifts from ${from} to ${to}`
  }

  return "Lifetime giving"
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function formatDonorTypeLabel(value: string | null | undefined) {
  if (value === "organization") return "Organization"
  if (value === "individual") return "Individual"
  return value || "—"
}
