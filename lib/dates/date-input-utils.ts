const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

type NormalizeDateOfBirthOptions = {
  /** When false, blank input returns null instead of throwing. Default true (signup flows). */
  required?: boolean
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Validates and normalizes YYYY-MM-DD for date of birth fields. */
export function normalizeDateOfBirth(
  value: string | null | undefined,
  options: NormalizeDateOfBirthOptions = {}
): string | null {
  const { required = true } = options
  const trimmed = String(value || "").trim()

  if (!trimmed) {
    if (required) {
      throw new Error("Date of birth is required.")
    }
    return null
  }

  if (!ISO_DATE_PATTERN.test(trimmed)) {
    throw new Error("Date of birth must use a valid year (4 digits).")
  }

  const parsed = new Date(`${trimmed}T00:00:00`)

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Date of birth must be a valid date.")
  }

  const normalized = parsed.toISOString().slice(0, 10)

  if (normalized !== trimmed) {
    throw new Error("Date of birth must be a valid date.")
  }

  const year = parsed.getFullYear()
  const currentYear = new Date().getFullYear()

  if (year < 1900 || year > currentYear) {
    throw new Error(
      `Date of birth year must be between 1900 and ${currentYear}.`
    )
  }

  if (normalized > todayIsoDate()) {
    throw new Error("Date of birth cannot be in the future.")
  }

  return normalized
}
