import { createClient } from "@/lib/supabase/server"

import type {
  CustomerRentalContractDto,
  CustomerRentalDocumentDto,
  CustomerRentalFinancialContext,
  CustomerRentalPaymentDto,
  CustomerRentalPaymentSummaryDto,
  CustomerVenueRentalDetailDto,
  CustomerContractDisplayStatus,
  CustomerDocumentDisplayStatus,
  CustomerPaymentDisplayStatus,
} from "./customer-venue-rental-dtos"
import { formatVenueRentalDateTime } from "./venue-rental-format"
import { getVenueRentalQueueRows } from "./venue-rental-queries"
import type {
  RentalContractRecord,
  RentalPaymentRecord,
  RentalPaymentStatus,
  RentalContractStatus,
} from "./venue-rental-types"
import {
  RENTAL_CONTRACT_STATUSES,
  RENTAL_PAYMENT_STATUSES,
  RENTAL_PAYMENT_TYPES,
} from "./venue-rental-types"

const PAID_PAYMENT_STATUSES = new Set<RentalPaymentStatus>([
  RENTAL_PAYMENT_STATUSES.paidManually,
  RENTAL_PAYMENT_STATUSES.paidStripeLater,
])

function formatCustomerDate(value: string | null): string | null {
  if (!value) return null
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function mapCustomerPaymentStatus(
  status: RentalPaymentStatus
): CustomerPaymentDisplayStatus {
  switch (status) {
    case RENTAL_PAYMENT_STATUSES.paidManually:
    case RENTAL_PAYMENT_STATUSES.paidStripeLater:
      return "Paid"
    case RENTAL_PAYMENT_STATUSES.paymentRequested:
      return "Pending"
    case RENTAL_PAYMENT_STATUSES.refunded:
      return "Refunded"
    default:
      return "Unpaid"
  }
}

export function mapCustomerContractStatus(
  status: RentalContractStatus | null | undefined
): CustomerContractDisplayStatus {
  switch (status) {
    case RENTAL_CONTRACT_STATUSES.sent:
      return "Sent"
    case RENTAL_CONTRACT_STATUSES.signed:
      return "Signed"
    default:
      return "Not Available"
  }
}

function paymentLabel(paymentType: CustomerRentalPaymentDto["paymentType"]): string {
  switch (paymentType) {
    case "deposit":
      return "Deposit"
    case "security_deposit":
      return "Security Deposit"
    case "remaining_balance":
      return "Remaining Balance"
  }
}

export function toCustomerPaymentDto(
  payment: RentalPaymentRecord
): CustomerRentalPaymentDto | null {
  if (
    payment.payment_type !== RENTAL_PAYMENT_TYPES.deposit &&
    payment.payment_type !== RENTAL_PAYMENT_TYPES.securityDeposit &&
    payment.payment_type !== RENTAL_PAYMENT_TYPES.remainingBalance
  ) {
    return null
  }

  const isPaid = PAID_PAYMENT_STATUSES.has(payment.status)
  const displayStatus = mapCustomerPaymentStatus(payment.status)
  const isDue =
    !isPaid &&
    payment.status !== RENTAL_PAYMENT_STATUSES.refunded &&
    payment.amount > 0

  return {
    id: payment.id,
    paymentType: payment.payment_type,
    label: paymentLabel(payment.payment_type),
    amount: Number(payment.amount),
    currency: payment.currency,
    dueDate: payment.due_at,
    dueDateLabel: formatCustomerDate(payment.due_at),
    status: displayStatus,
    paidDate: payment.paid_at,
    paidDateLabel: payment.paid_at ? formatVenueRentalDateTime(payment.paid_at) : null,
    isPaid,
    isDue,
  }
}

export function toCustomerContractDto(
  contract: RentalContractRecord | null
): CustomerRentalContractDto | null {
  if (!contract) return null

  const status = mapCustomerContractStatus(contract.status)

  return {
    id: contract.id,
    status,
    documentUrl: contract.document_url,
    sentAt: contract.sent_at,
    signedAt: contract.signed_at,
    canDownload: Boolean(contract.document_url && status !== "Not Available"),
    canSign: status === "Sent",
  }
}

export function buildCustomerPaymentSummary(
  payments: RentalPaymentRecord[],
  rentalStatus?: string
): CustomerRentalPaymentSummaryDto {
  const mapped = payments
    .map(toCustomerPaymentDto)
    .filter((payment): payment is CustomerRentalPaymentDto => payment !== null)

  const deposit = mapped.find((payment) => payment.paymentType === "deposit") ?? null
  const securityDeposit =
    mapped.find((payment) => payment.paymentType === "security_deposit") ?? null
  const remainingBalance =
    mapped.find((payment) => payment.paymentType === "remaining_balance") ?? null

  const outstandingBalance = mapped
    .filter((payment) => payment.isDue)
    .reduce((sum, payment) => sum + payment.amount, 0)

  let refundStatus: CustomerRentalPaymentSummaryDto["refundStatus"] = "none"
  let refundLabel: string | null = null

  if (rentalStatus === "awaiting_security_deposit_refund_approval") {
    refundStatus = "processing"
    refundLabel = "Security Deposit Refund Processing"
  } else if (
    rentalStatus === "security_deposit_refunded" ||
    securityDeposit?.status === "Refunded"
  ) {
    refundStatus = "refunded"
    refundLabel = "Security Deposit Refunded"
  }

  return {
    deposit,
    securityDeposit,
    remainingBalance,
    outstandingBalance,
    refundStatus,
    refundLabel,
  }
}

export function buildCustomerDocuments(
  contract: CustomerRentalContractDto | null,
  payments: CustomerRentalPaymentSummaryDto
): CustomerRentalDocumentDto[] {
  const agreementStatus: CustomerDocumentDisplayStatus =
    contract?.status === "Signed"
      ? "Signed"
      : contract?.status === "Sent"
        ? "Available"
        : "Not Available"

  const documents: CustomerRentalDocumentDto[] = [
    {
      id: contract?.id ?? "rental-agreement",
      type: "rental_agreement",
      label: "Rental Agreement",
      status: agreementStatus,
      downloadUrl: contract?.canDownload ? contract.documentUrl : null,
    },
  ]

  const paidPayments = [
    payments.deposit,
    payments.securityDeposit,
    payments.remainingBalance,
  ].filter(
    (payment): payment is CustomerRentalPaymentDto =>
      payment !== null && payment.isPaid
  )

  if (paidPayments.length) {
    documents.push({
      id: "receipts",
      type: "receipt",
      label: "Receipts",
      status: "Available",
      downloadUrl: null,
      description: `${paidPayments.length} payment${paidPayments.length === 1 ? "" : "s"} recorded`,
    })
  } else {
    documents.push({
      id: "receipts",
      type: "receipt",
      label: "Receipts",
      status: "Not Available",
      downloadUrl: null,
    })
  }

  documents.push({
    id: "future-documents",
    type: "future",
    label: "Future Documents",
    status: "Not Available",
    downloadUrl: null,
    description: "Additional documents will appear here when available.",
  })

  return documents
}

async function getCustomerRentalPayments(
  venueRentalId: string,
  organizationId: string
): Promise<RentalPaymentRecord[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("rental_payments")
    .select(
      "id, organization_id, venue_rental_id, payment_type, status, amount, currency, due_at, paid_at, created_at, updated_at"
    )
    .eq("organization_id", organizationId)
    .eq("venue_rental_id", venueRentalId)
    .order("created_at", { ascending: true })

  if (error) {
    if (error.code === "42P01") {
      return []
    }
    console.error(error)
    throw new Error("Failed to load rental payments")
  }

  return (data || []) as RentalPaymentRecord[]
}

async function getCustomerRentalContract(
  venueRentalId: string,
  organizationId: string
): Promise<RentalContractRecord | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("rental_contracts")
    .select(
      "id, organization_id, venue_rental_id, status, document_url, generated_at, sent_at, signed_at, voided_at, created_at, updated_at"
    )
    .eq("organization_id", organizationId)
    .eq("venue_rental_id", venueRentalId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    if (error.code === "42P01") {
      return null
    }
    console.error(error)
    throw new Error("Failed to load rental contract")
  }

  return (data as RentalContractRecord | null) ?? null
}

export async function getCustomerRentalFinancialContext(
  venueRentalId: string,
  organizationId: string,
  rentalStatus?: string
): Promise<CustomerRentalFinancialContext> {
  const [payments, contractRecord] = await Promise.all([
    getCustomerRentalPayments(venueRentalId, organizationId),
    getCustomerRentalContract(venueRentalId, organizationId),
  ])

  const contract = toCustomerContractDto(contractRecord)
  const paymentSummary = buildCustomerPaymentSummary(payments, rentalStatus)

  return { payments: paymentSummary, contract }
}

export async function getCustomerRentalFinancialContexts(
  rentalIds: string[],
  organizationId: string,
  statusByRentalId: Record<string, string>
): Promise<Map<string, CustomerRentalFinancialContext>> {
  const map = new Map<string, CustomerRentalFinancialContext>()

  if (!rentalIds.length) {
    return map
  }

  await Promise.all(
    rentalIds.map(async (rentalId) => {
      const context = await getCustomerRentalFinancialContext(
        rentalId,
        organizationId,
        statusByRentalId[rentalId]
      )
      map.set(rentalId, context)
    })
  )

  return map
}

export async function getCustomerVenueRentalDetail(
  rentalId: string,
  customerUserId: string,
  organizationId: string
): Promise<CustomerVenueRentalDetailDto | null> {
  const rows = await getVenueRentalQueueRows({
    customerUserId,
    organizationId,
  })

  const rental = rows.find((row) => row.id === rentalId)

  if (!rental) {
    return null
  }

  const supabase = await createClient()
  const { data: rentalMeta } = await supabase
    .from("venue_rentals")
    .select("approved_at")
    .eq("id", rentalId)
    .eq("customer_user_id", customerUserId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  const { payments, contract } = await getCustomerRentalFinancialContext(
    rentalId,
    organizationId,
    rental.status
  )

  return {
    rental,
    approvedAt: (rentalMeta?.approved_at as string | null) ?? null,
    payments,
    contract,
    documents: buildCustomerDocuments(contract, payments),
  }
}

export function formatCustomerCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export { formatCustomerDate }
