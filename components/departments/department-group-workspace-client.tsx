"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  BookOpen,
  CalendarClock,
  CalendarDays,
  DollarSign,
  Heart,
  LayoutDashboard,
  Loader2,
  Pencil,
  PieChart,
  Settings,
  Users,
  Wallet,
} from "lucide-react"

import { DepartmentBudgetPanel } from "@/components/departments/department-budget-panel"
import { DepartmentEventsPanel } from "@/components/departments/department-events-panel"
import { DepartmentExpensesPanel } from "@/components/departments/department-expenses-panel"
import { DepartmentGroupGivingPanel } from "@/components/departments/department-group-giving-panel"
import { DepartmentOverviewPanel } from "@/components/departments/department-overview-panel"
import { DepartmentPayrollPanel } from "@/components/departments/department-payroll-panel"
import { DepartmentProgramsPanel } from "@/components/departments/department-programs-panel"
import { DepartmentSchedulePanel } from "@/components/departments/department-schedule-panel"
import { DepartmentSettingsPanel } from "@/components/departments/department-settings-panel"
import { DepartmentStudentsPanel } from "@/components/departments/department-students-panel"
import { DonationGroupEditForm } from "@/components/donations/donation-group-edit-form"
import { Header } from "@/components/layout/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { mapStatus, STATUS_COLORS } from "@/lib/contacts/contact-constants"
import {
  fetchDepartmentDetail,
  type DepartmentDetail,
} from "@/lib/departments/department-actions"
import {
  ensureDepartmentGivingLinkAction,
  findGivingGroupForDepartmentAction,
  type DepartmentGivingPair,
} from "@/lib/departments/department-giving-link"
import { WORKFORCE_DEPARTMENTS_PATH } from "@/lib/departments/department-paths"
import {
  departmentGroupWorkspaceHref,
  donationGroupGivingListHref,
  parseDepartmentFinanceSection,
  parseDepartmentStudentsSection,
  parseDepartmentWorkspaceTab,
  type GroupWorkspaceTab,
} from "@/lib/donations/donation-group-path"
import { DONATIONS_GROUP_GIVING_REPORT_PATH } from "@/lib/donations/donor-giving-report"
import {
  isSafeReturnToPath,
  RETURN_TO_QUERY_PARAM,
} from "@/lib/navigation/return-to"
import { PROGRAM_LABEL_PLURAL } from "@/lib/programs/program-display-labels"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type DepartmentGroupWorkspaceClientProps = {
  departmentId: string
  /** When opened from Group Giving, prefer this back link context. */
  entryPoint?: "hr" | "donations"
  canManageEvents?: boolean
  canRequestEvents?: boolean
}

type GroupEditRecord = {
  id: string
  full_name: string | null
  primary_contact_name: string | null
  status: string | null
  notes: string | null
  giving_group_kind?: string | null
  linked_hr_team_id?: string | null
  linked_department_id?: string | null
}

export function DepartmentGroupWorkspaceClient({
  departmentId,
  entryPoint = "hr",
  canManageEvents = false,
  canRequestEvents = false,
}: DepartmentGroupWorkspaceClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [department, setDepartment] = useState<DepartmentDetail | null>(null)
  const [pair, setPair] = useState<DepartmentGivingPair | null>(null)
  const [groupEdit, setGroupEdit] = useState<GroupEditRecord | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)

  const returnTo = searchParams.get(RETURN_TO_QUERY_PARAM)
  const rawTab = searchParams.get("tab")
  const activeTab = parseDepartmentWorkspaceTab(rawTab)
  const yearProgramId = searchParams.get("year")
  const financeSection = parseDepartmentFinanceSection(
    rawTab,
    searchParams.get("section")
  )
  const studentsSection = parseDepartmentStudentsSection(
    rawTab,
    searchParams.get("section")
  )

  const backHref =
    entryPoint === "donations"
      ? donationGroupGivingListHref(
          returnTo && isSafeReturnToPath(returnTo)
            ? returnTo
            : DONATIONS_GROUP_GIVING_REPORT_PATH
        )
      : returnTo && isSafeReturnToPath(returnTo)
        ? returnTo
        : WORKFORCE_DEPARTMENTS_PATH

  const backLabel = entryPoint === "donations" ? "Group Giving" : "Departments"

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [departmentData, pairResult] = await Promise.all([
        fetchDepartmentDetail(departmentId),
        findGivingGroupForDepartmentAction(departmentId),
      ])

      if (!departmentData) {
        setDepartment(null)
        setPair(null)
        setError("This department could not be found.")
        setLoading(false)
        return
      }

      setDepartment(departmentData)

      let nextPair = pairResult.success ? pairResult.pair : null

      if (nextPair?.linkSource === "name_match") {
        const ensured = await ensureDepartmentGivingLinkAction({
          departmentId: nextPair.departmentId,
          groupContactId: nextPair.groupContactId,
        })
        if (ensured.success) {
          nextPair = { ...nextPair, linkSource: "linked" }
        }
      }

      setPair(nextPair)

      if (nextPair) {
        const { data: groupRow } = await supabase
          .from("contacts")
          .select(
            "id, full_name, primary_contact_name, status, notes, giving_group_kind, linked_hr_team_id, linked_department_id"
          )
          .eq("id", nextPair.groupContactId)
          .maybeSingle()

        if (groupRow) {
          setGroupEdit({
            ...(groupRow as GroupEditRecord),
            giving_group_kind: "department",
            linked_department_id: departmentId,
          })
        } else {
          setGroupEdit(null)
        }
      } else {
        setGroupEdit(null)
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load workspace."
      )
      setDepartment(null)
      setPair(null)
    } finally {
      setLoading(false)
    }
  }, [departmentId, supabase])

  useEffect(() => {
    void load()
  }, [load])

  function handleTabChange(tab: string) {
    const next = parseDepartmentWorkspaceTab(tab)
    // Don't show giving tabs when there is no paired group
    const safeTab = !pair && next === "group-giving" ? "overview" : next

    router.replace(
      departmentGroupWorkspaceHref(departmentId, {
        tab: safeTab,
        finance: safeTab === "financial" ? financeSection : undefined,
        returnTo: returnTo && isSafeReturnToPath(returnTo) ? returnTo : undefined,
      }),
      { scroll: false }
    )
  }

  function handleFinanceSectionChange(section: string) {
    const next = parseDepartmentFinanceSection("financial", section)
    router.replace(
      departmentGroupWorkspaceHref(departmentId, {
        tab: "financial",
        finance: next,
        returnTo: returnTo && isSafeReturnToPath(returnTo) ? returnTo : undefined,
      }),
      { scroll: false }
    )
  }

  function handleStudentsSectionChange(section: string) {
    const next =
      parseDepartmentStudentsSection("students", section) ?? "roster"
    router.replace(
      departmentGroupWorkspaceHref(departmentId, {
        tab: "students",
        studentsSection: next,
        returnTo: returnTo && isSafeReturnToPath(returnTo) ? returnTo : undefined,
      }),
      { scroll: false }
    )
  }

  if (loading) {
    return (
      <>
        <Header title="Department" />
        <div className="flex items-center gap-2 p-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading workspace...
        </div>
      </>
    )
  }

  if (!department) {
    return (
      <>
        <Header title="Department Not Found" />
        <div className="space-y-4 p-6">
          <p className="text-sm text-muted-foreground">
            {error || "This department could not be found."}
          </p>
          <Button variant="outline" asChild>
            <Link href={backHref}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {backLabel}
            </Link>
          </Button>
        </div>
      </>
    )
  }

  const displayName = department.name
  const mappedStatus = pair?.groupStatus ? mapStatus(pair.groupStatus) : null
  const hasGiving = Boolean(pair?.groupContactId)
  const resolvedTab: GroupWorkspaceTab =
    !hasGiving && activeTab === "group-giving" ? "overview" : activeTab

  return (
    <>
      <Header title={displayName} breadcrumbExtras={[{ label: displayName }]} />
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-block size-3 rounded-full border"
                style={{ backgroundColor: department.color || "#3b82f6" }}
              />
              <h1 className="text-2xl font-semibold tracking-tight">{displayName}</h1>
              {mappedStatus ? (
                <Badge
                  variant="secondary"
                  className={cn("font-normal", STATUS_COLORS[mappedStatus])}
                >
                  {mappedStatus}
                </Badge>
              ) : null}
              <Badge variant="outline" className="font-normal">
                Department
              </Badge>
            </div>
          </div>
          {groupEdit ? (
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Edit group
            </Button>
          ) : null}
        </div>

        <Tabs value={resolvedTab} onValueChange={handleTabChange}>
          <TabsList className="flex h-auto flex-wrap justify-start gap-1">
            <TabsTrigger value="overview" className="gap-2">
              <LayoutDashboard className="size-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="programs" className="gap-2">
              <BookOpen className="size-4" />
              {PROGRAM_LABEL_PLURAL}
            </TabsTrigger>
            <TabsTrigger value="students" className="gap-2">
              <Users className="size-4" />
              Participants
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-2">
              <CalendarClock className="size-4" />
              Schedule
            </TabsTrigger>
            <TabsTrigger value="financial" className="gap-2">
              <PieChart className="size-4" />
              Financial
            </TabsTrigger>
            {hasGiving ? (
              <TabsTrigger value="group-giving" className="gap-2">
                <Heart className="size-4" />
                Group giving
              </TabsTrigger>
            ) : null}
            <TabsTrigger value="activity" className="gap-2">
              <CalendarDays className="size-4" />
              Events
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="size-4" />
              Settings
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {resolvedTab === "overview" ? (
          <DepartmentOverviewPanel
            departmentId={department.id}
            departmentName={displayName}
            highlightYearProgramId={yearProgramId}
          />
        ) : null}

        {resolvedTab === "programs" ? (
          <DepartmentProgramsPanel
            departmentId={department.id}
            departmentName={displayName}
            initialYearProgramId={yearProgramId}
          />
        ) : null}

        {resolvedTab === "students" ? (
          <DepartmentStudentsPanel
            departmentId={department.id}
            departmentName={displayName}
            initialSection={studentsSection}
            onSectionChange={handleStudentsSectionChange}
          />
        ) : null}

        {resolvedTab === "schedule" ? (
          <DepartmentSchedulePanel
            departmentId={department.id}
            departmentName={displayName}
          />
        ) : null}

        {resolvedTab === "financial" ? (
          <div className="space-y-4">
            <Tabs
              value={financeSection}
              onValueChange={handleFinanceSectionChange}
            >
              <TabsList className="flex h-auto flex-wrap justify-start gap-1">
                <TabsTrigger value="payroll" className="gap-2">
                  <Wallet className="size-4" />
                  Payroll
                </TabsTrigger>
                <TabsTrigger value="expenses" className="gap-2">
                  <DollarSign className="size-4" />
                  Expenses
                </TabsTrigger>
                <TabsTrigger value="budget" className="gap-2">
                  <PieChart className="size-4" />
                  Financial Summary
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {financeSection === "payroll" ? (
              <DepartmentPayrollPanel
                departmentId={department.id}
                departmentName={displayName}
                staff={department.staff}
                onStaffChanged={load}
              />
            ) : null}

            {financeSection === "expenses" ? (
              <DepartmentExpensesPanel
                departmentId={department.id}
                departmentName={displayName}
              />
            ) : null}

            {financeSection === "budget" ? (
              <DepartmentBudgetPanel
                departmentId={department.id}
                departmentName={displayName}
              />
            ) : null}
          </div>
        ) : null}

        {resolvedTab === "group-giving" && pair ? (
          <DepartmentGroupGivingPanel
            groupContactId={pair.groupContactId}
            groupName={pair.groupName || displayName}
            refreshToken={refreshToken}
          />
        ) : null}

        {resolvedTab === "activity" ? (
          <DepartmentEventsPanel
            departmentId={department.id}
            departmentName={displayName}
            canManageEvents={canManageEvents}
            canRequestEvents={canRequestEvents}
            refreshToken={refreshToken}
          />
        ) : null}

        {resolvedTab === "settings" ? (
          <DepartmentSettingsPanel
            departmentId={department.id}
            departmentName={displayName}
          />
        ) : null}
      </div>

      {groupEdit ? (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit group</DialogTitle>
            </DialogHeader>
            <DonationGroupEditForm
              group={groupEdit}
              onCancel={() => setEditOpen(false)}
              onSaved={async () => {
                setEditOpen(false)
                await load()
                setRefreshToken((current) => current + 1)
              }}
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}
