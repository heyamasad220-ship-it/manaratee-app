// lib/payments/payment-status.ts

export const PAYMENT_STATUSES = {
  pendingReview: "pending_review",
  unallocated: "unallocated",
  allocated: "allocated",
  duplicate: "duplicate",
  ignored: "ignored",
} as const;

export type PaymentStatus =
  (typeof PAYMENT_STATUSES)[keyof typeof PAYMENT_STATUSES];

export function getPaymentStatusLabel(status: PaymentStatus): string {
  switch (status) {
    case "pending_review":
      return "Pending Review";
    case "unallocated":
      return "Unallocated";
    case "allocated":
      return "Allocated";
    case "duplicate":
      return "Duplicate";
    case "ignored":
      return "Ignored";
    default:
      return status;
  }
}