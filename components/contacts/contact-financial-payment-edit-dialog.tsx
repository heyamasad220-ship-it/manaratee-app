"use client"

import {
  DonorDonationHistoryTable,
  type DonationHistoryRow,
} from "@/components/donations/donor-donation-history-table"

type ContactFinancialPaymentEditDialogProps = {
  donorId: string
  donation: DonationHistoryRow
  initialDialog?: "edit" | "allocate"
  onUpdated: () => void
  onClosed: () => void
}

export function ContactFinancialPaymentEditDialog({
  donorId,
  donation,
  initialDialog = "edit",
  onUpdated,
  onClosed,
}: ContactFinancialPaymentEditDialogProps) {
  return (
    <DonorDonationHistoryTable
      key={`${donation.id}-${initialDialog}`}
      donorId={donorId}
      donations={[donation]}
      actionsOnly
      initialDialog={initialDialog}
      onDialogClosed={onClosed}
      onUpdated={onUpdated}
    />
  )
}
