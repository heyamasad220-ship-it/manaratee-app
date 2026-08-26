"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { AddonsReportTable } from "@/components/programs/addons-report-table"
import { PaymentSummaryReportPanel } from "@/components/programs/payment-summary-report-panel"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OrgReportsClient } from "@/components/reports/org-reports-client"
import { getAddonReportRows } from "@/lib/programs/addons-report"
import type { AddonReportRow } from "@/lib/programs/addon-display"
import type { ProgramFinanceSection } from "@/lib/programs/program-workspace-path"

function ProgramWorkspaceAddonsReport({ programId }: { programId: string }) {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [rows, setRows] = React.useState<AddonReportRow[]>([])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const result = await getAddonReportRows()
      if (cancelled) return
      if (!result.success) {
        setError(result.error)
        setRows([])
      } else {
        setRows(result.rows)
      }
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading add-ons…
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  return <AddonsReportTable rows={rows} lockedProgramId={programId} />
}

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
          <TabsTrigger value="addons">Add-ons</TabsTrigger>
        </TabsList>
      </Tabs>

      {section === "transactions" ? (
        <OrgReportsClient lockedProgramId={programId} />
      ) : null}
      {section === "payment-summary" ? (
        <PaymentSummaryReportPanel lockedProgramId={programId} />
      ) : null}
      {section === "addons" ? (
        <ProgramWorkspaceAddonsReport programId={programId} />
      ) : null}
    </div>
  )
}
