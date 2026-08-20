export type CustomerTicketStatus =
  | "valid"
  | "checked_in"
  | "waitlisted"
  | "canceled"
  | "refunded"

export type CustomerTicketOrderStatus =
  | "pending"
  | "completed"
  | "canceled"
  | "refunded"
  | "partially_refunded"

export type CustomerTicketSeat = {
  id: string
  ticketCode: string
  attendeeName: string | null
  ticketTypeName: string
  status: CustomerTicketStatus
  checkedInAt: string | null
}

export type CustomerTicketOrder = {
  id: string
  orderNumber: string
  status: CustomerTicketOrderStatus
  totalCents: number
  refundedCents: number
  currency: string
  paymentMethod: string | null
  createdAt: string
  eventId: string
  eventName: string
  eventStartAt: string | null
  eventLocation: string | null
  publicEventPath: string | null
  canResumeCheckout: boolean
  tickets: CustomerTicketSeat[]
}

export function mapCustomerTicketStatus(status: string): CustomerTicketStatus {
  if (
    status === "valid" ||
    status === "checked_in" ||
    status === "waitlisted" ||
    status === "canceled" ||
    status === "refunded"
  ) {
    return status
  }
  return "valid"
}

export function mapCustomerTicketOrderStatus(
  status: string
): CustomerTicketOrderStatus {
  if (
    status === "pending" ||
    status === "completed" ||
    status === "canceled" ||
    status === "refunded" ||
    status === "partially_refunded"
  ) {
    return status
  }
  return "pending"
}

export function buildTicketCodeQrUrl(ticketCode: string, size = 240) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(ticketCode)}`
}

export function customerTicketStatusLabel(status: CustomerTicketStatus) {
  if (status === "checked_in") return "Checked in"
  if (status === "waitlisted") return "Waitlisted"
  if (status === "canceled") return "Canceled"
  if (status === "refunded") return "Refunded"
  return "Ready"
}

export function customerOrderStatusLabel(status: CustomerTicketOrderStatus) {
  if (status === "pending") return "Payment pending"
  if (status === "refunded") return "Refunded"
  if (status === "partially_refunded") return "Partially refunded"
  if (status === "canceled") return "Canceled"
  return "Confirmed"
}
