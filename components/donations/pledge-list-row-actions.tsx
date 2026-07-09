"use client"

import { MoreHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  PledgeReminderDialogs,
  PledgeReminderDropdownItems,
  usePledgeReminderControls,
} from "@/components/donations/pledge-reminder-actions"

type PledgeListRowActionsProps = {
  pledgeId: string
  donorName: string
  balanceRemaining: number
  onViewDetails: () => void
  onRecordPayment: () => void
  onManagePaymentPlan: () => void
  onEditPledge: () => void
  onDeletePledge: () => void
  onReminderUpdated?: () => void
}

export function PledgeListRowActions({
  pledgeId,
  donorName,
  balanceRemaining,
  onViewDetails,
  onRecordPayment,
  onManagePaymentPlan,
  onEditPledge,
  onDeletePledge,
  onReminderUpdated,
}: PledgeListRowActionsProps) {
  const canRemind = balanceRemaining > 0.009
  const reminderControls = usePledgeReminderControls(
    pledgeId,
    canRemind ? onReminderUpdated : undefined
  )

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            className="h-8 w-8 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Pledge actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
          <DropdownMenuItem
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onViewDetails()
            }}
          >
            View Details
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onRecordPayment()
            }}
          >
            Record Payment
          </DropdownMenuItem>
          {balanceRemaining > 0.009 ? (
            <DropdownMenuItem
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onManagePaymentPlan()
              }}
            >
              Payment Plan
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onEditPledge()
            }}
          >
            Edit Pledge
          </DropdownMenuItem>
          {canRemind ? <PledgeReminderDropdownItems controls={reminderControls} /> : null}
          <DropdownMenuItem
            className="text-red-600"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onDeletePledge()
            }}
          >
            Delete Pledge
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {canRemind ? (
        <PledgeReminderDialogs controls={reminderControls} donorName={donorName} />
      ) : null}
    </>
  )
}
