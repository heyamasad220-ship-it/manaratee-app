import type { VenueRentalQueueRow } from "./venue-rental-types"

export type CustomerPaymentDisplayStatus = "Unpaid" | "Pending" | "Paid" | "Refunded"

export type CustomerContractDisplayStatus = "Not Available" | "Sent" | "Signed"

export type CustomerDocumentDisplayStatus = "Not Available" | "Available" | "Signed"

export type CustomerRentalPaymentDto = {
  id: string
  paymentType: "deposit" | "security_deposit" | "remaining_balance"
  label: string
  amount: number
  currency: string
  dueDate: string | null
  dueDateLabel: string | null
  status: CustomerPaymentDisplayStatus
  paidDate: string | null
  paidDateLabel: string | null
  isPaid: boolean
  isDue: boolean
}

export type CustomerRentalContractDto = {
  id: string
  status: CustomerContractDisplayStatus
  documentUrl: string | null
  sentAt: string | null
  signedAt: string | null
  canDownload: boolean
  canSign: boolean
}

export type CustomerRentalDocumentDto = {
  id: string
  type: "rental_agreement" | "receipt" | "future"
  label: string
  status: CustomerDocumentDisplayStatus
  downloadUrl: string | null
  description?: string
}

export type CustomerRentalRefundStatus = "none" | "processing" | "refunded"

export type CustomerRentalPaymentSummaryDto = {
  deposit: CustomerRentalPaymentDto | null
  securityDeposit: CustomerRentalPaymentDto | null
  remainingBalance: CustomerRentalPaymentDto | null
  outstandingBalance: number
  refundStatus: CustomerRentalRefundStatus
  refundLabel: string | null
}

export type CustomerVenueRentalDetailDto = {
  rental: VenueRentalQueueRow
  approvedAt: string | null
  payments: CustomerRentalPaymentSummaryDto
  contract: CustomerRentalContractDto | null
  documents: CustomerRentalDocumentDto[]
}

export type CustomerRentalFinancialContext = {
  payments: CustomerRentalPaymentSummaryDto
  contract: CustomerRentalContractDto | null
}
