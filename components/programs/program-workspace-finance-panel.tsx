"use client"

import { PaymentSummaryReportPanel } from "@/components/programs/payment-summary-report-panel"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OrgReportsClient } from "@/components/reports/org-reports-client"
import type { ProgramFinanceSection } from "@/lib/programs/program-workspace-path"

export function ProgramWorkspaceFinancePanel({
  programId,
  section,
  onSectionChange,
}: {
  programId: string
  section: ProgramFinanceSection
  onSectionChange: (section: ProgramFinanceSection) => void
}) {
  return (
    <div className="space-y-4">
      <Tabs
        value={section}
        onValueChange={(value) =>
          onSectionChange(value as ProgramFinanceSection)
        }
        className="gap-0"
      >
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="payment-summary">Payment Summary</TabsTrigger>
        </TabsList>
      </Tabs>

      {section === "transactions" ? (
        <OrgReportsClient lockedProgramId={programId} />
      ) : null}
      {section === "payment-summary" ? (
        <PaymentSummaryReportPanel lockedProgramId={programId} />
      ) : null}
    </div>
  )
}
