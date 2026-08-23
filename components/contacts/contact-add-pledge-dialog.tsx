"use client"

import { PledgeDetailsDialog } from "@/components/donations/pledge-details-dialog"

type ContactAddPledgeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactId: string
  contactName: string
  organizationId?: string | null
  onSuccess?: () => void
}

export function ContactAddPledgeDialog({
  open,
  onOpenChange,
  contactId,
  contactName,
  organizationId,
  onSuccess,
}: ContactAddPledgeDialogProps) {
  return (
    <PledgeDetailsDialog
      open={open}
      onOpenChange={onOpenChange}
      organizationId={organizationId}
      defaultContactId={contactId}
      defaultContactLabel={contactName}
      onSaved={() => onSuccess?.()}
    />
  )
}
