/**
 * Helpers for Registrations report fee breakdown and program duration labels.
 * Client-safe (no server imports).
 */

import { isTransactionFeeAddon } from "@/lib/programs/addon-display"

const REGISTRATION_LINE_TYPES = new Set([
  "registration_fee",
  "tuition",
  "season_fee",
  "program_fee",
])

const SKIP_ADDITIONAL_LINE_TYPES = new Set([
  "discount",
  "sibling_discount",
  "scholarship",
  "financial_assistance",
  "fa",
  "credit",
  "adjustment",
])

export type RegistrationFeeLineInput = {
  line_type: string
  label: string
  amount: number
  metadata?: Record<string, unknown> | null
}

export type RegistrationChargeInput = {
  id: string
  enrollment_id: string | null
  charge_type: string
  total: number
  subtotal?: number | null
  discount_total?: number | null
  metadata?: Record<string, unknown> | null
  quote_snapshot?: Record<string, unknown> | null
}

export type AdditionalFeeItem = {
  label: string
  amount: number
}

export type EnrollmentFeeBreakdown = {
  registrationFee: number | null
  additionalFees: AdditionalFeeItem[]
  discountAmount: number
  discountReasons: string[]
}

function lineIsActive(line: RegistrationFeeLineInput) {
  const status = String(line.metadata?.status || "active").toLowerCase()
  return status !== "voided"
}

function isDiscountLine(line: RegistrationFeeLineInput) {
  const type = String(line.line_type || "").toLowerCase()
  if (SKIP_ADDITIONAL_LINE_TYPES.has(type)) return true
  if (Number(line.amount) < -0.009) return true
  const label = String(line.label || "").toLowerCase()
  return label.includes("discount") || label.includes("scholarship")
}

function chargeLabel(charge: RegistrationChargeInput) {
  const meta = charge.metadata || {}
  const quote = charge.quote_snapshot || {}
  const fromMeta =
    (typeof meta.label === "string" && meta.label.trim()) ||
    (typeof meta.addon_kind === "string" && meta.addon_kind.trim()) ||
    null
  const fromQuote =
    (typeof quote.type === "string" && quote.type.trim()) || null
  if (fromMeta) return fromMeta
  if (fromQuote === "transaction_fee") return "Transaction fee"
  if (fromQuote) return fromQuote.replace(/_/g, " ")
  if (charge.charge_type === "addon") return "Additional fee"
  return "Fee"
}

function titleCaseLabel(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return "Additional fee"
  return trimmed.replace(/_/g, " ")
}

/**
 * Calendar span between start and end dates as "1 month" / "9 months".
 * Uses inclusive month difference when both dates are valid.
 */
export function formatProgramDuration(
  startDate: string | null | undefined,
  endDate: string | null | undefined
): string | null {
  if (!startDate || !endDate) return null
  const start = new Date(`${String(startDate).slice(0, 10)}T00:00:00`)
  const end = new Date(`${String(endDate).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  if (end < start) return null

  let months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth())
  if (end.getDate() >= start.getDate()) {
    months += 1
  }
  if (months < 1) months = 1

  return months === 1 ? "1 month" : `${months} months`
}

export function buildEnrollmentFeeBreakdown(
  charges: RegistrationChargeInput[],
  linesByChargeId: Map<string, RegistrationFeeLineInput[]>
): EnrollmentFeeBreakdown {
  const registrationCharges = charges.filter(
    (c) => String(c.charge_type).toLowerCase() === "registration"
  )
  const addonCharges = charges.filter((c) => {
    const type = String(c.charge_type).toLowerCase()
    return type === "addon" || type === "fee"
  })

  const additionalFees: AdditionalFeeItem[] = []
  const discountReasons: string[] = []
  let registrationFee: number | null = null
  let discountAmount = 0

  for (const charge of registrationCharges) {
    const lines = (linesByChargeId.get(charge.id) || []).filter(lineIsActive)
    const discountLines = lines.filter((line) => isDiscountLine(line))
    const regLines = lines.filter(
      (line) =>
        REGISTRATION_LINE_TYPES.has(String(line.line_type).toLowerCase()) &&
        !isDiscountLine(line)
    )
    const otherLines = lines.filter((line) => {
      if (isDiscountLine(line)) return false
      const type = String(line.line_type).toLowerCase()
      if (REGISTRATION_LINE_TYPES.has(type)) return false
      if (Number(line.amount) <= 0) return false
      return true
    })

    if (regLines.length > 0) {
      const sum = regLines.reduce((s, line) => s + Number(line.amount || 0), 0)
      const discounts = discountLines.reduce(
        (s, line) => s + Math.abs(Number(line.amount || 0)),
        0
      )
      const subtotal = Number(charge.subtotal || 0)
      // Prefer explicit subtotal (gross). If tuition lines look net of discounts,
      // restore list price so Fee + Discount reason reads clearly.
      if (subtotal > 0.009) {
        registrationFee = (registrationFee || 0) + subtotal
      } else if (discounts > 0.009 && Math.abs(sum + discounts - Number(charge.total || 0)) < 0.02) {
        registrationFee = (registrationFee || 0) + sum + discounts
      } else {
        registrationFee = (registrationFee || 0) + sum
      }
    } else if (otherLines.length > 0 || discountLines.length > 0) {
      const extras = otherLines.reduce(
        (s, line) => s + Number(line.amount || 0),
        0
      )
      const discounts = discountLines.reduce(
        (s, line) => s + Math.abs(Number(line.amount || 0)),
        0
      )
      const subtotal = Number(charge.subtotal || 0)
      const net = Number(charge.total || 0)
      registrationFee =
        (registrationFee || 0) +
        (subtotal > 0.009
          ? subtotal
          : Math.max(0, net - extras + discounts))
    } else {
      const subtotal = Number(charge.subtotal || 0)
      registrationFee =
        (registrationFee || 0) +
        (subtotal > 0.009 ? subtotal : Number(charge.total || 0))
    }

    for (const line of discountLines) {
      const amount = Math.abs(Number(line.amount || 0))
      if (amount <= 0.009) continue
      discountAmount += amount
      const reason = titleCaseLabel(
        line.label || line.line_type || "Discount"
      )
      if (!discountReasons.includes(reason)) discountReasons.push(reason)
    }

    if (discountLines.length === 0) {
      const chargeDiscount = Number(charge.discount_total || 0)
      if (chargeDiscount > 0.009) {
        discountAmount += chargeDiscount
      }
    }

    for (const line of otherLines) {
      if (
        isTransactionFeeAddon({
          label: line.label,
          lineType: line.line_type,
          metadata: line.metadata,
        })
      ) {
        continue
      }
      additionalFees.push({
        label: titleCaseLabel(line.label || line.line_type || "Additional fee"),
        amount: Number(line.amount || 0),
      })
    }
  }

  for (const charge of addonCharges) {
    const lines = (linesByChargeId.get(charge.id) || []).filter(lineIsActive)
    if (lines.length > 0) {
      for (const line of lines) {
        if (isDiscountLine(line)) {
          const amount = Math.abs(Number(line.amount || 0))
          if (amount <= 0.009) continue
          discountAmount += amount
          const reason = titleCaseLabel(
            line.label || line.line_type || "Discount"
          )
          if (!discountReasons.includes(reason)) discountReasons.push(reason)
          continue
        }
        if (Number(line.amount) <= 0) continue
        const type = String(line.line_type).toLowerCase()
        if (SKIP_ADDITIONAL_LINE_TYPES.has(type)) continue
        if (
          isTransactionFeeAddon({
            label: line.label,
            lineType: line.line_type,
            chargeType: charge.charge_type,
            metadata: {
              ...(charge.metadata || {}),
              ...(line.metadata || {}),
            },
            quote: charge.quote_snapshot,
          })
        ) {
          continue
        }
        additionalFees.push({
          label: titleCaseLabel(
            line.label || chargeLabel(charge) || line.line_type
          ),
          amount: Number(line.amount || 0),
        })
      }
    } else if (Number(charge.total) > 0) {
      if (
        isTransactionFeeAddon({
          chargeType: charge.charge_type,
          metadata: charge.metadata,
          quote: charge.quote_snapshot,
        })
      ) {
        continue
      }
      additionalFees.push({
        label: titleCaseLabel(chargeLabel(charge)),
        amount: Number(charge.total || 0),
      })
    }
  }

  return {
    registrationFee,
    additionalFees,
    discountAmount,
    discountReasons,
  }
}

const EMPTY_ALLERGY_VALUES = new Set([
  "",
  "-",
  "—",
  "none",
  "n/a",
  "na",
  "n a",
  "no",
  "nil",
  "unknown",
])

function isEmptyAllergyValue(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[.]/g, "")
    .replace(/\s+/g, " ")
    .trim()
  return EMPTY_ALLERGY_VALUES.has(normalized)
}

function cleanAllergyToken(raw: string): string | null {
  const value = raw.replace(/^any\s+allergies\s*:\s*/i, "").trim()
  if (!value || isEmptyAllergyValue(value)) return null
  return value
}

/** Pull allergies text from enrollment notes / import lines. */
export function extractAllergiesFromNotes(
  notes: string | null | undefined
): string | null {
  if (!notes) return null
  const match = String(notes).match(/Allergies:\s*(.+?)(?:\n|$)/i)
  const blob = match?.[1]?.trim()
  if (!blob) return null

  const unique: string[] = []
  const seen = new Set<string>()
  for (const part of blob.split(/;|\|/)) {
    const cleaned = cleanAllergyToken(part)
    if (!cleaned) continue
    const key = cleaned.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(cleaned)
  }
  return unique.length > 0 ? unique.join("; ") : null
}

/** Pull photo consent from enrollment notes / import lines. */
export function extractPhotoConsentFromNotes(
  notes: string | null | undefined
): string | null {
  if (!notes) return null
  const match = String(notes).match(/Photo consent:\s*(.+?)(?:\n|$)/i)
  const value = match?.[1]?.trim()
  return value || null
}

/** Pull emergency contact from enrollment notes when explicitly stored. */
export function extractEmergencyContactFromNotes(
  notes: string | null | undefined
): string | null {
  if (!notes) return null
  const match = String(notes).match(
    /Emergency contact(?:\s*details)?\s*:\s*(.+?)(?:\n|$)/i
  )
  const value = match?.[1]?.trim()
  return value || null
}

function replaceOrAppendNoteLine(
  notes: string | null | undefined,
  labelPattern: RegExp,
  nextLine: string | null
) {
  const lines = String(notes || "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
  const nextLines: string[] = []
  let replaced = false

  for (const line of lines) {
    if (!line.trim()) {
      if (nextLines.length > 0 && nextLines[nextLines.length - 1] !== "") {
        nextLines.push("")
      }
      continue
    }
    if (labelPattern.test(line)) {
      if (nextLine && !replaced) {
        nextLines.push(nextLine)
        replaced = true
      }
      continue
    }
    nextLines.push(line)
  }

  if (nextLine && !replaced) {
    nextLines.push(nextLine)
  }

  return nextLines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** Upsert structured participant detail lines inside enrollment notes. */
export function upsertParticipantDetailNotes(
  notes: string | null | undefined,
  input: {
    allergies?: string | null
    photoConsent?: string | null
    emergencyContact?: string | null
  }
) {
  let next = String(notes || "")

  if (input.allergies !== undefined) {
    const value = input.allergies?.trim() || null
    next = replaceOrAppendNoteLine(
      next,
      /^Allergies:\s*/i,
      value ? `Allergies: ${value}` : null
    )
  }

  if (input.photoConsent !== undefined) {
    const value = input.photoConsent?.trim() || null
    next = replaceOrAppendNoteLine(
      next,
      /^Photo consent:\s*/i,
      value ? `Photo consent: ${value}` : null
    )
  }

  if (input.emergencyContact !== undefined) {
    const value = input.emergencyContact?.trim() || null
    next = replaceOrAppendNoteLine(
      next,
      /^Emergency contact(?:\s*details)?\s*:/i,
      value ? `Emergency contact: ${value}` : null
    )
  }

  return next || null
}

/** Display “10 × $120.00”. One-time amounts omit the multiplier. */
export function formatMonthsTimesFee(
  months: number,
  monthlyFee: number,
  currency = "USD"
): string {
  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(Number(monthlyFee || 0))
  const count = Math.max(0, Math.round(Number(months || 0)))
  if (count <= 1) return money
  return `${count} × ${money}`
}

/** Most common installment amount + number of plan rows. */
export function summarizeInstallments(amounts: number[]): {
  months: number
  monthlyFee: number
} {
  const values = amounts
    .map((value) => Math.round(Number(value || 0) * 100) / 100)
    .filter((value) => Number.isFinite(value))
  if (values.length === 0) return { months: 0, monthlyFee: 0 }

  const counts = new Map<number, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) || 0) + 1)
  }
  let monthlyFee = values[0]
  let best = 0
  for (const [amount, count] of counts) {
    if (count > best) {
      monthlyFee = amount
      best = count
    }
  }
  return { months: values.length, monthlyFee }
}

/** Age in whole years from YYYY-MM-DD (or ISO) date of birth. */
export function calculateAgeFromDateOfBirth(
  dateOfBirth: string | null | undefined,
  asOf: Date = new Date()
): number | null {
  if (!dateOfBirth) return null
  const birth = new Date(
    dateOfBirth.includes("T")
      ? dateOfBirth
      : `${String(dateOfBirth).slice(0, 10)}T00:00:00`
  )
  if (Number.isNaN(birth.getTime())) return null
  let age = asOf.getFullYear() - birth.getFullYear()
  const monthDiff = asOf.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < birth.getDate())) {
    age -= 1
  }
  return age >= 0 ? age : null
}
