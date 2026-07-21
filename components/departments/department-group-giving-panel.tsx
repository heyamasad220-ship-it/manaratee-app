"use client"

import { DonationGroupFinancialPanel } from "@/components/donations/donation-group-financial-panel"

/**
 * Department Group giving tab: campaign gifts only (who donated per campaign).
 * Not a standing membership roster — separate from Participants, Financial Summary, and payroll.
 */
export function DepartmentGroupGivingPanel({
  groupContactId,
  groupName,
  refreshToken,
}: {
  groupContactId: string
  groupName: string
  refreshToken?: number
}) {
  return (
    <DonationGroupFinancialPanel
      groupContactId={groupContactId}
      groupName={groupName}
      refreshToken={refreshToken}
    />
  )
}
