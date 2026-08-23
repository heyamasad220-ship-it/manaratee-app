"use client"

import { PledgeDetailsDialog } from "@/components/donations/pledge-details-dialog"

type ContactFinancialPledgeEditDialogProps = {
  pledgeId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated?: () => void
}

export function ContactFinancialPledgeEditDialog({
  pledgeId,
  open,
  onOpenChange,
  onUpdated,
}: ContactFinancialPledgeEditDialogProps) {
  return (
    <PledgeDetailsDialog
      open={open}
      onOpenChange={onOpenChange}
      pledgeId={pledgeId}
      onSaved={() => onUpdated?.()}
      onDeleted={() => {
        onOpenChange(false)
        onUpdated?.()
      }}
    />
  )
}
