import type {
  VenueBookingPaymentStatus,
  VenueBookingStatus,
} from "./venue-booking-types"

export function formatVenueBookingStatus(status: string | null): {
  status: VenueBookingStatus
  label: string
} {
  const normalized = (status || "pending_review") as VenueBookingStatus

  const labels: Record<VenueBookingStatus, string> = {
    pending_review: "Pending",
    approved: "Approved",
    confirmed: "Confirmed",
    rejected: "Rejected",
    cancelled: "Cancelled",
  }

  return {
    status: normalized in labels ? normalized : "pending_review",
    label: labels[normalized in labels ? normalized : "pending_review"],
  }
}

export function formatVenueBookingPaymentStatus(input: {
  total_amount: number | null
  balance_due: number | null
  status: string | null
}): VenueBookingPaymentStatus {
  const total = Number(input.total_amount || 0)
  const balance = Number(input.balance_due ?? total)

  if (total <= 0) {
    return "Not Invoiced"
  }

  if (balance <= 0) {
    return "Fully Paid"
  }

  if (balance < total) {
    return "Deposit Paid"
  }

  return input.status === "pending_review" ? "Not Invoiced" : "Invoice Sent"
}

export function formatVenueBookingDate(value: string | null) {
  if (!value) {
    return "Date not set"
  }

  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function formatVenueBookingDateTime(value: string | null) {
  if (!value) {
    return "Unknown"
  }

  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function formatVenueBookingTime(value: string | null) {
  if (!value) {
    return "--"
  }

  const [hours, minutes] = value.split(":").map(Number)
  if (Number.isNaN(hours)) {
    return value
  }

  const date = new Date()
  date.setHours(hours, minutes || 0, 0, 0)

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })
}

export function shortVenueBookingId(id: string) {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase()
}
