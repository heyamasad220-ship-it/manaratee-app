"use client"

import { ContactFinancialPanel } from "@/components/contacts/contact-financial-panel"
import { ContactGroupGivingOverview } from "@/components/contacts/contact-group-giving-overview"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ContactProfileModuleFlags } from "@/lib/contacts/contact-profile-module-access"

type ContactGroupFinancialPanelProps = {
  groupContactId: string
  donorId: string
  groupName: string
  modules: ContactProfileModuleFlags
}

/** @deprecated Prefer ContactFinancialPanel with isGroup — kept for any legacy imports. */
export function ContactGroupFinancialPanel({
  groupContactId,
  donorId,
  groupName,
  modules,
}: ContactGroupFinancialPanelProps) {
  return (
    <div className="space-y-6">
      <ContactGroupGivingOverview groupContactId={groupContactId} groupName={groupName} />

      <Card>
        <CardHeader>
          <CardTitle>Group Gifts &amp; Pledges</CardTitle>
          <CardDescription>
            Pooled gifts and campaign pledges recorded on {groupName}. Member payoffs may appear on
            individual member profiles or as pledge payments here when recorded on the group.
          </CardDescription>
        </CardHeader>
      </Card>

      <ContactFinancialPanel
        contactId={groupContactId}
        contactName={groupName}
        donorId={donorId}
        isGroup
        modules={modules}
      />
    </div>
  )
}
