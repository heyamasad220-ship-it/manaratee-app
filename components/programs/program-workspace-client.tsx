"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  BarChart3,
  BookOpen,
  CalendarClock,
  ClipboardList,
  Landmark,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react"

import { DepartmentProgramDashboardPanel } from "@/components/departments/department-program-dashboard-panel"
import { DepartmentProgramsPanel } from "@/components/departments/department-programs-panel"
import { DepartmentSchedulePanel } from "@/components/departments/department-schedule-panel"
import { DepartmentStudentsPanel } from "@/components/departments/department-students-panel"
import { ProgramWorkspaceFinancePanel } from "@/components/programs/program-workspace-finance-panel"
import { ProgramWorkspaceReportsPanel } from "@/components/programs/program-workspace-reports-panel"
import { ProgramWorkspaceSettingsPanel } from "@/components/programs/program-workspace-settings-panel"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  departmentGroupWorkspaceHref,
  type DepartmentScheduleSection,
} from "@/lib/donations/donation-group-path"
import { isApplicationBasedProgram } from "@/lib/programs/enrollment-process"
import { getHierarchyLabels } from "@/lib/programs/program-display-labels"
import { getProgramKindTagLabel } from "@/lib/programs/program-kind"
import {
  getProgramStatusLabel,
  type ProgramStatus,
} from "@/lib/programs/program-status"
import type { Program } from "@/lib/programs/program-types"
import {
  isLegacyProgramApplicationsQuery,
  isLegacyReportsAddons,
  isLegacyReportsPaymentSummary,
  isLegacyReportsWaitlist,
  parseProgramFinanceSection,
  parseProgramReportsSection,
  parseProgramScheduleSection,
  parseProgramWorkspaceTab,
  programWorkspaceHref,
  type ProgramFinanceSection,
  type ProgramReportsSection,
  type ProgramWorkspaceTab,
} from "@/lib/programs/program-workspace-path"

export function ProgramWorkspaceClient({
  program,
  departmentId,
  departmentName,
}: {
  program: Program
  departmentId: string
  departmentName: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [programName, setProgramName] = useState(program.name)

  const searchTab = searchParams.get("tab")
  const searchSection = searchParams.get("section")
  const leftoverPaymentSummary = isLegacyReportsPaymentSummary(
    searchTab,
    searchSection
  )
  const leftoverAddons = isLegacyReportsAddons(searchTab, searchSection)
  const leftoverWaitlist = isLegacyReportsWaitlist(searchTab, searchSection)
  const leftoverFinanceSection = leftoverPaymentSummary || leftoverAddons
  const applicationBased = isApplicationBasedProgram(program)
  const leftoverApplications = isLegacyProgramApplicationsQuery(
    searchTab,
    searchSection
  )
  const parsedTab = leftoverFinanceSection
    ? "finance"
    : leftoverApplications && applicationBased
      ? "applications"
      : parseProgramWorkspaceTab(searchTab)
  const activeTab: ProgramWorkspaceTab =
    parsedTab === "applications" && !applicationBased ? "students" : parsedTab
  const scheduleSection = parseProgramScheduleSection(
    activeTab === "schedule" ? "schedule" : null,
    searchSection
  )
  const financeSection = leftoverPaymentSummary
    ? "payment-summary"
    : leftoverAddons
      ? "addons"
      : parseProgramFinanceSection(
          activeTab === "finance" ? searchSection : null
        )
  const reportsSection = parseProgramReportsSection(
    activeTab === "reports" ? searchSection : null
  )
  const labels = getHierarchyLabels(program.program_kind)

  useEffect(() => {
    if (leftoverPaymentSummary) {
      router.replace(
        programWorkspaceHref(program.id, {
          tab: "finance",
          financeSection: "payment-summary",
        }),
        { scroll: false }
      )
      return
    }
    if (leftoverAddons) {
      router.replace(
        programWorkspaceHref(program.id, {
          tab: "finance",
          financeSection: "addons",
        }),
        { scroll: false }
      )
      return
    }
    if (!leftoverWaitlist) return
    router.replace(
      programWorkspaceHref(program.id, { tab: "reports" }),
      { scroll: false }
    )
  }, [
    leftoverAddons,
    leftoverPaymentSummary,
    leftoverWaitlist,
    program.id,
    router,
  ])

  useEffect(() => {
    if (leftoverApplications && applicationBased) {
      router.replace(
        programWorkspaceHref(program.id, { tab: "applications" }),
        { scroll: false }
      )
      return
    }
    if (
      leftoverApplications ||
      (parsedTab === "applications" && !applicationBased)
    ) {
      router.replace(programWorkspaceHref(program.id, { tab: "students" }), {
        scroll: false,
      })
    }
  }, [
    leftoverApplications,
    applicationBased,
    parsedTab,
    program.id,
    router,
  ])

  function handleTabChange(tab: string) {
    const next = parseProgramWorkspaceTab(tab)
    router.replace(programWorkspaceHref(program.id, { tab: next }), {
      scroll: false,
    })
  }

  function handleScheduleSectionChange(section: DepartmentScheduleSection) {
    router.replace(
      programWorkspaceHref(program.id, {
        tab: "schedule",
        scheduleSection: section,
      }),
      { scroll: false }
    )
  }

  function handleFinanceSectionChange(section: ProgramFinanceSection) {
    router.replace(
      programWorkspaceHref(program.id, {
        tab: "finance",
        financeSection: section,
      }),
      { scroll: false }
    )
  }

  function handleReportsSectionChange(section: ProgramReportsSection) {
    router.replace(
      programWorkspaceHref(program.id, {
        tab: "reports",
        reportsSection: section,
      }),
      { scroll: false }
    )
  }

  const tabValue: ProgramWorkspaceTab = activeTab

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{programName}</h1>
          <Badge variant="outline" className="font-normal">
            {getProgramKindTagLabel(program.program_kind)}
          </Badge>
          <Badge variant="outline" className="font-normal">
            {getProgramStatusLabel(
              (program.status as ProgramStatus) || "active"
            )}
          </Badge>
        </div>
        {departmentName && departmentId ? (
          <Link
            href={departmentGroupWorkspaceHref(departmentId)}
            className="inline-block text-sm font-medium text-sky-700 hover:text-sky-800 hover:underline"
          >
            {departmentName}
          </Link>
        ) : null}
      </div>

      <Tabs value={tabValue} onValueChange={handleTabChange} className="gap-0">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="overview" className="gap-2">
            <LayoutDashboard className="size-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="offerings" className="gap-2">
            <BookOpen className="size-4" />
            {labels.offeringPlural}
          </TabsTrigger>
          {applicationBased ? (
            <TabsTrigger value="applications" className="gap-2">
              <ClipboardList className="size-4" />
              Applications
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="students" className="gap-2">
            <Users className="size-4" />
            Registrations
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-2">
            <CalendarClock className="size-4" />
            Schedule
          </TabsTrigger>
          <TabsTrigger value="finance" className="gap-2">
            <Landmark className="size-4" />
            Finance
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2">
            <BarChart3 className="size-4" />
            Reports
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="size-4" />
            Settings
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === "overview" ? (
        <DepartmentProgramDashboardPanel
          departmentId={departmentId}
          yearProgramId={program.id}
        />
      ) : null}

      {activeTab === "offerings" ? (
        <DepartmentProgramsPanel
          departmentId={departmentId}
          departmentName={departmentName}
          initialYearProgramId={program.id}
        />
      ) : null}

      {activeTab === "applications" ? (
        <DepartmentStudentsPanel
          departmentId={departmentId}
          departmentName={departmentName}
          program={program}
          view="applications"
        />
      ) : null}

      {activeTab === "students" ? (
        <DepartmentStudentsPanel
          departmentId={departmentId}
          departmentName={departmentName}
          program={program}
          view="enrollments"
        />
      ) : null}

      {activeTab === "schedule" ? (
        <DepartmentSchedulePanel
          departmentId={departmentId}
          departmentName={departmentName}
          programId={program.id}
          programName={programName}
          initialSection={scheduleSection}
          onSectionChange={handleScheduleSectionChange}
        />
      ) : null}

      {activeTab === "finance" ? (
        <ProgramWorkspaceFinancePanel
          programId={program.id}
          section={financeSection}
          onSectionChange={handleFinanceSectionChange}
        />
      ) : null}

      {activeTab === "reports" ? (
        <ProgramWorkspaceReportsPanel
          programId={program.id}
          section={reportsSection}
          onSectionChange={handleReportsSectionChange}
        />
      ) : null}

      {activeTab === "settings" ? (
        <ProgramWorkspaceSettingsPanel
          program={{ ...program, name: programName }}
          departmentId={departmentId}
          onProgramMetaChanged={() => {
            setProgramName(program.name)
          }}
        />
      ) : null}
    </div>
  )
}
