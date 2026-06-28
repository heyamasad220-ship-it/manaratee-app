"use client"

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ContactDonorFinancialPanel } from "@/components/contacts/contact-donor-financial-panel"
import { ContactGroupGivingOverview } from "@/components/contacts/contact-group-giving-overview"

type ContactGroupFinancialPanelProps = {
  groupContactId: string
  donorId: string
  groupName: string
}

export function ContactGroupFinancialPanel({
  groupContactId,
  donorId,
  groupName,
}: ContactGroupFinancialPanelProps) {
  return (
    <div className="space-y-6">
      <ContactGroupGivingOverview groupContactId={groupContactId} groupName={groupName} />

      <Card>
        <CardHeader>
          <CardTitle>Group Gifts</CardTitle>
          <CardDescription>
            Checks and pooled gifts recorded directly on {groupName}. Groups do not take pledges.
          </CardDescription>
        </CardHeader>
      </Card>

      <ContactDonorFinancialPanel donorId={donorId} donorName={groupName} />
    </div>
  )
}
