export type StaffPayBasis = "hourly" | "monthly" | "unpaid"

export const STAFF_PAY_BASIS_OPTIONS = [
  { value: "hourly", label: "Hourly" },
  { value: "monthly", label: "Monthly salary" },
  { value: "unpaid", label: "Unpaid (volunteer)" },
] as const

export function parseStaffPayBasis(value: unknown): StaffPayBasis {
  const normalized = String(value || "").toLowerCase().trim()
  if (normalized === "monthly" || normalized === "unpaid") return normalized
  return "hourly"
}

export function isUnpaidStaffPayBasis(value: unknown) {
  return parseStaffPayBasis(value) === "unpaid"
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatStaffPayRate(input: {
  payBasis: StaffPayBasis | string | null | undefined
  hourlyRate: number | null
  monthlySalary: number | null
}) {
  const payBasis = parseStaffPayBasis(input.payBasis)
  if (payBasis === "unpaid") return "Unpaid"
  if (payBasis === "monthly") {
    return input.monthlySalary == null
      ? "Monthly"
      : `${formatUsd(input.monthlySalary)}/mo`
  }
  return input.hourlyRate == null
    ? "Hourly"
    : `${formatUsd(input.hourlyRate)}/hr`
}

export function staffPayBasisLabel(value: unknown) {
  const payBasis = parseStaffPayBasis(value)
  return (
    STAFF_PAY_BASIS_OPTIONS.find((option) => option.value === payBasis)?.label ||
    "Hourly"
  )
}
