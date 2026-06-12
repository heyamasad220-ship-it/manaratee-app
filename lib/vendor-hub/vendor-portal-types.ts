export type VendorBazaarActivityType =
  | "application"
  | "participation"
  | "booth_assignment"
  | "payment"

export type VendorBazaarActivityRow = {
  id: string
  organizationId: string
  organizationName: string
  contactId: string
  eventId: string | null
  eventName: string
  eventDate: string | null
  activityType: VendorBazaarActivityType
  status: string | null
  amount: number | null
  boothNumber: string | null
  occurredAt: string | null
}

export type VendorBoothPaymentDue = {
  assignmentId: string
  eventId: string
  eventName: string
  eventDate: string | null
  organizationId: string
  organizationName: string
  boothNumber: string | null
  feeAmount: number
  paidAmount: number
  balanceDue: number
  assignmentStatus: string | null
}

export type MyVendorBazaarSummary = {
  linkedContactCount: number
  organizationCount: number
  upcomingEventCount: number
  rows: VendorBazaarActivityRow[]
  paymentDue: VendorBoothPaymentDue[]
  tablesAvailable: boolean
}
