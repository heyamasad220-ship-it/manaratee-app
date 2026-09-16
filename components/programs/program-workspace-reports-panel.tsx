"use client"

import { ProgramsAttendanceReportPanel } from "@/components/programs/programs-attendance-waitlist-report-panels"
import { ProgramYearComparisonPanel } from "@/components/programs/program-year-comparison-panel"
import {
  ProgramEnrollmentOverviewPanel,
  ProgramEnrollmentTrendsPanel,
} from "@/components/programs/program-workspace-enrollment-reports"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ProgramReportsSection } from "@/lib/programs/program-workspace-path"

export function ProgramWorkspaceReportsPanel({
  programId,
  programName,
  departmentId,
  startDate,
  section,
  onSectionChange,
}: {
  programId: string
  programName: string
  departmentId: string
  startDate: string | null
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
          <TabsTrigger value="enrollments">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="year-comparison">Year comparison</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
        </TabsList>
      </Tabs>

      {section === "enrollments" ? (
        <ProgramEnrollmentOverviewPanel programId={programId} />
      ) : null}
      {section === "trends" ? (
        <ProgramEnrollmentTrendsPanel programId={programId} />
      ) : null}
      {section === "year-comparison" ? (
        <ProgramYearComparisonPanel
          programName={programName}
          departmentId={departmentId}
          startDate={startDate}
        />
      ) : null}
      {section === "attendance" ? (
        <ProgramsAttendanceReportPanel lockedProgramId={programId} />
      ) : null}
    </div>
  )
}
