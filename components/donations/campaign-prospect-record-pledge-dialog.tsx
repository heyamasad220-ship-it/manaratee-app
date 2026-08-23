"use client"

import { PledgeDetailsDialog } from "@/components/donations/pledge-details-dialog"

type CampaignProspectRecordPledgeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  prospectId: string | null
  organizationId: string
  onConverted: (result: {
    pledgeId: string
    amountPledged: number
    suggestedAskAmount: number | null
  }) => void
}

export function CampaignProspectRecordPledgeDialog({
  open,
  onOpenChange,
  prospectId,
  organizationId,
  onConverted,
}: CampaignProspectRecordPledgeDialogProps) {
  return (
    <PledgeDetailsDialog
      open={open}
      onOpenChange={onOpenChange}
      prospectId={prospectId}
      organizationId={organizationId}
      onSaved={(pledgeId) =>
        onConverted({
          pledgeId,
          amountPledged: 0,
          suggestedAskAmount: null,
        })
      }
    />
  )
}
