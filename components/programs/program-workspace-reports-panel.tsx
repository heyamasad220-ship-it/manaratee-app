"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { AddonsReportTable } from "@/components/programs/addons-report-table"
import { EnrollmentsReportTable } from "@/components/programs/enrollments-report-table"
import {
  ProgramsAttendanceReportPanel,
  ProgramsWaitlistReportPanel,
} from "@/components/programs/programs-attendance-waitlist-report-panels"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getAddonReportRows } from "@/lib/programs/addons-report"
import { getEnrollmentsReportRows } from "@/lib/programs/enrollments-report"
import type { AddonReportRow } from "@/lib/programs/addon-display"
import type { EnrollmentsReportTableRow } from "@/lib/programs/enrollments-report-types"
import type { ProgramReportsSection } from "@/lib/programs/program-workspace-path"

function ProgramWorkspaceEnrollmentsReport({
  programId,
}: {
  programId: string
}) {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [rows, setRows] = React.useState<EnrollmentsReportTableRow[]>([])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const result = await getEnrollmentsReportRows({ programId })
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
  }, [programId])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading enrollments…
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  return <EnrollmentsReportTable rows={rows} lockedProgramId={programId} />
}

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

export function ProgramWorkspaceReportsPanel({
  programId,
  section,
  onSectionChange,
}: {
  programId: string
  section: ProgramReportsSection
  onSectionChange: (section: ProgramReportsSection) => void
}) {
  return (
    <div className="space-y-4">
      <Tabs
        value={section}
        onValueChange={(value) =>
          onSectionChange(value as ProgramReportsSection)
        }
        className="gap-0"
      >
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="enrollments">Enrollments</TabsTrigger>
          <TabsTrigger value="addons">Add-ons</TabsTrigger>
          <TabsTrigger value="waitlist">Waitlist</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
        </TabsList>
      </Tabs>

      {section === "enrollments" ? (
        <ProgramWorkspaceEnrollmentsReport programId={programId} />
      ) : null}
      {section === "addons" ? (
        <ProgramWorkspaceAddonsReport programId={programId} />
      ) : null}
      {section === "waitlist" ? (
        <ProgramsWaitlistReportPanel lockedProgramId={programId} />
      ) : null}
      {section === "attendance" ? (
        <ProgramsAttendanceReportPanel lockedProgramId={programId} />
      ) : null}
    </div>
  )
}
