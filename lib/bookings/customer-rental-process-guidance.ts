export type CustomerRentalPaymentActionType =
  | "pay_deposit"
  | "pay_security_deposit"
  | "pay_remaining_balance"

export type CustomerRentalProcessGuidance = {
  title: string
  description: string
}

const PAYMENT_ACTION_TYPES = new Set<string>([
  "pay_deposit",
  "pay_security_deposit",
  "pay_remaining_balance",
])

export function isCustomerPaymentActionType(
  actionType: string | undefined
): actionType is CustomerRentalPaymentActionType {
  return actionType !== undefined && PAYMENT_ACTION_TYPES.has(actionType)
}

function paymentSubjectLabel(
  actionType: "pay_deposit" | "pay_security_deposit" | "pay_remaining_balance"
): string {
  switch (actionType) {
    case "pay_security_deposit":
      return "security deposit"
    case "pay_remaining_balance":
      return "remaining balance"
    default:
      return "deposit"
  }
}

/** Customer-facing guidance while payments are collected externally (pre–online checkout). */
export function getCustomerPaymentProcessGuidance(
  actionType?: CustomerRentalPaymentActionType,
  options?: { dueDateLabel?: string | null }
): CustomerRentalProcessGuidance {
  if (actionType === "pay_deposit" || actionType === "pay_security_deposit") {
    const subject = paymentSubjectLabel(actionType)
    const dueSuffix = options?.dueDateLabel ? ` Payment is due by ${options.dueDateLabel}.` : ""

    return {
      title: `${subject.charAt(0).toUpperCase()}${subject.slice(1)} due`,
      description: `Our team will email you instructions to pay your ${subject}.${dueSuffix} After payment is received, staff will record it here and your rental status will update.`,
    }
  }

  if (actionType === "pay_remaining_balance") {
    const dueSuffix = options?.dueDateLabel
      ? ` Your remaining balance is due by ${options.dueDateLabel}.`
      : ""

    return {
      title: "Remaining balance due",
      description: `Our team will contact you with payment instructions.${dueSuffix} After payment is received, staff will record it here.`,
    }
  }

  return {
    title: "Payments handled by our team",
    description:
      "When payment is required, our staff will email you instructions. After you pay externally, staff will record your payment here and your status will update.",
  }
}

/** Short label for dashboard cards — describes what the customer should expect, not a pay button. */
export function getCustomerPaymentNextStepLabel(
  actionType: "pay_deposit" | "pay_security_deposit" | "pay_remaining_balance",
  options?: { dueDateLabel?: string | null }
): string {
  if (actionType === "pay_remaining_balance" && options?.dueDateLabel) {
    return `Await balance instructions (due ${options.dueDateLabel})`
  }

  switch (actionType) {
    case "pay_deposit":
      return "Await deposit payment instructions"
    case "pay_security_deposit":
      return "Await security deposit instructions"
    case "pay_remaining_balance":
      return "Await remaining balance instructions"
  }
}

/** Primary next-action sentence shown on the rental detail page. */
export function getCustomerPaymentNextActionLabel(
  actionType: "pay_deposit" | "pay_security_deposit" | "pay_remaining_balance",
  options?: { dueDateLabel?: string | null; holdDeadlineLabel?: string | null }
): string {
  if (actionType === "pay_deposit" && options?.holdDeadlineLabel) {
    return `Deposit due — watch for payment instructions from our team by ${options.holdDeadlineLabel}`
  }

  if (actionType === "pay_remaining_balance" && options?.dueDateLabel) {
    return `Remaining balance due by ${options.dueDateLabel} — our team will send payment instructions`
  }

  switch (actionType) {
    case "pay_deposit":
      return "Deposit due — watch for payment instructions from our team"
    case "pay_security_deposit":
      return "Security deposit due — watch for payment instructions from our team"
    case "pay_remaining_balance":
      return "Remaining balance due — our team will send payment instructions"
  }
}

/** Customer-facing guidance while contract e-sign is not yet available. */
export function getCustomerContractProcessGuidance(): CustomerRentalProcessGuidance {
  return {
    title: "Agreement ready to review",
    description:
      "Download your rental agreement below. Our team will contact you if anything else is needed before your event. In-portal signing will be available in a future update.",
  }
}

export function getCustomerContractNextStepLabel(): string {
  return "Review agreement — staff will confirm next steps"
}

export function getCustomerContractNextActionLabel(): string {
  return "Review your rental agreement — our team will follow up if needed"
}

export const CUSTOMER_RENTAL_PAYMENTS_SECTION_GUIDANCE =
  "Payments are collected by our team outside this portal. Amounts and due dates are shown below. When payment is due, staff will email you instructions."
