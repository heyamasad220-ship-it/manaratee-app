const DECLINE_REASON_LABELS: Record<string, string> = {
  insufficient_funds: "Insufficient funds",
  expired_card: "Card expired",
  incorrect_number: "Incorrect card number",
  invalid_number: "Incorrect card number",
  incorrect_cvc: "Incorrect security code",
  invalid_cvc: "Incorrect security code",
  invalid_expiry_month: "Card expired",
  invalid_expiry_year: "Card expired",
  incorrect_zip: "Incorrect postal code",
  card_declined: "Card declined",
  generic_decline: "Card declined",
  do_not_honor: "Card declined",
  lost_card: "Card declined",
  stolen_card: "Card declined",
  pickup_card: "Card declined",
  fraudulent: "Card declined",
  card_velocity_exceeded: "Card declined",
  processing_error: "Processing error",
  authentication_required: "Authentication required",
  try_again_later: "Try again later",
}

export function formatChargeFailureReason(input: {
  declineCode?: string | null
  failureCode?: string | null
  failureMessage?: string | null
}) {
  const declineCode = input.declineCode?.trim().toLowerCase()
  const failureCode = input.failureCode?.trim().toLowerCase()
  if (declineCode && DECLINE_REASON_LABELS[declineCode]) return DECLINE_REASON_LABELS[declineCode]
  if (failureCode && DECLINE_REASON_LABELS[failureCode]) return DECLINE_REASON_LABELS[failureCode]
  const message = input.failureMessage?.trim()
  if (message) return message
  return "Card declined"
}

export function formatChargeFailureCard(input: {
  brand?: string | null
  last4?: string | null
}) {
  const last4 = input.last4?.trim()
  const brand = input.brand?.trim()
  if (!last4 && !brand) return null
  const brandLabel = brand
    ? brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase()
    : "Card"
  return last4 ? `${brandLabel} •••• ${last4}` : brandLabel
}

export function formatChargeFailureKind(kind: string | null | undefined) {
  switch (kind) {
    case "pledge":
      return "Pledge"
    case "recurring":
      return "Recurring donation"
    default:
      return "One-time donation"
  }
}
