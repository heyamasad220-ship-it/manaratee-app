/** Legacy venue_bookings row shapes — used until Phase B venue_rentals cutover. */

export type VenueBookingStatus =
  | "pending_review"
  | "approved"
  | "confirmed"
  | "rejected"
  | "cancelled"

export type VenueBookingPaymentStatus =
  | "Not Invoiced"
  | "Invoice Sent"
  | "Deposit Paid"
  | "Fully Paid"
  | "Overdue"

export interface VenueBookingCustomer {
  name: string
  email: string | null
}

export interface VenueBookingDashboardRow {
  id: string
  shortId: string
  customer: VenueBookingCustomer
  venueName: string
  eventType: string
  eventDate: string
  eventDateLabel: string
  startTime: string
  endTime: string
  timeLabel: string
  expectedGuests: number
  submittedAt: string
  submittedAtLabel: string
  status: VenueBookingStatus
  statusLabel: string
  paymentStatus: VenueBookingPaymentStatus
  estimatedTotal: number
  notes: string | null
}

export interface VenueBookingDashboardStats {
  pendingCount: number
  approvedCount: number
  overdueCount: number
  pendingRevenue: number
}
