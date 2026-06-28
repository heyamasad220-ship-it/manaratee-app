export function normalizeCardNumber(value: string) {
  return value.replace(/\D/g, "")
}

export function formatCardNumberInput(value: string) {
  const digits = normalizeCardNumber(value).slice(0, 19)
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim()
}

export function formatExpirationInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 6)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

export function parseCardExpiration(value: string):
  | { ok: true; expMonth: number; expYear: number }
  | { ok: false; error: string } {
  const trimmed = value.trim()
  const match = trimmed.match(/^(\d{2})\/(\d{4})$/)
  if (!match) {
    return { ok: false, error: "Enter expiration as MM/YYYY." }
  }

  const expMonth = Number(match[1])
  const expYear = Number(match[2])

  if (!Number.isInteger(expMonth) || expMonth < 1 || expMonth > 12) {
    return { ok: false, error: "Enter a valid expiration month." }
  }

  if (!Number.isInteger(expYear) || expYear < 2000 || expYear > 9999) {
    return { ok: false, error: "Enter a valid expiration year." }
  }

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
    return { ok: false, error: "This card appears to be expired." }
  }

  return { ok: true, expMonth, expYear }
}

export function validateCardNumber(cardNumber: string): string | null {
  const digits = normalizeCardNumber(cardNumber)

  if (digits.length < 13 || digits.length > 19) {
    return "Enter a valid card number."
  }

  let sum = 0
  let shouldDouble = false
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index])
    if (shouldDouble) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    shouldDouble = !shouldDouble
  }

  if (sum % 10 !== 0) {
    return "Enter a valid card number."
  }

  return null
}

export function validateSecurityCode(
  securityCode: string,
  cardBrand?: string | null
): string | null {
  const digits = securityCode.replace(/\D/g, "")
  const isAmex = cardBrand?.toLowerCase().includes("american express")

  if (isAmex) {
    if (digits.length !== 4) {
      return "Enter the 4-digit security code."
    }
    return null
  }

  if (digits.length !== 3) {
    return "Enter the 3-digit security code."
  }

  return null
}

export function extractCardLast4(cardNumber: string) {
  return normalizeCardNumber(cardNumber).slice(-4)
}
