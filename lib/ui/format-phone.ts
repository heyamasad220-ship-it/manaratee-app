/** Display US phone numbers as (###) ###-####. Stored values are not changed. */

export function formatPhoneDisplay(phone?: string | null): string {
  if (!phone?.trim()) return ""

  const digits = phone.replace(/\D/g, "")
  const national =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits

  if (national.length === 10) {
    return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`
  }

  return phone.trim()
}

export function formatPhoneDisplayOrDash(
  phone?: string | null,
  empty = "—"
): string {
  return formatPhoneDisplay(phone) || empty
}

/** Format 10/11-digit phone sequences inside a free-text line (emergency contacts). */
export function formatPhonesInText(value?: string | null): string {
  if (!value?.trim()) return ""
  return value.replace(
    /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g,
    (match) => formatPhoneDisplay(match) || match
  )
}
