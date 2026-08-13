"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  BarChart3,
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
import { DepartmentProgramOverviewPanel } from "@/components/departments/department-program-overview-panel"
import { DepartmentProgramsCatalogPanel } from "@/components/departments/department-programs-catalog-panel"
import { DepartmentProgramsPanel } from "@/components/departments/department-programs-panel"
import { DepartmentReportsPanel } from "@/components/departments/department-reports-panel"
import { DepartmentSchedulePanel } from "@/components/departments/department-schedule-panel"
import { DepartmentSettingsPanel } from "@/components/departments/department-settings-panel"
import { DepartmentStudentsPanel } from "@/components/departments/department-students-panel"
import { FinancePayrollQueuePanel } from "@/components/finance/finance-payroll-queue-panel"
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
  isDepartmentYearRequiredTab,
  isDepartmentYearWorkspaceTab,
  parseDepartmentFinanceSection,
  parseDepartmentScheduleSection,
  parseDepartmentStudentsSection,
  parseDepartmentWorkspaceTab,
  type GroupWorkspaceTab,
} from "@/lib/donations/donation-group-path"
import { DONATIONS_GROUP_GIVING_REPORT_PATH } from "@/lib/donations/donor-giving-report"
import {
  isSafeReturnToPath,
  RETURN_TO_QUERY_PARAM,
} from "@/lib/navigation/return-to"
import {
  STAFF_MAIN_CONTENT_STICKY_TOP_CLASS,
  STAFF_MAIN_CONTENT_STICKY_TOP_REM,
} from "@/lib/layout/staff-dashboard-chrome"
import {
  getHierarchyLabels,
  YEAR_SEASON_LABEL_PLURAL,
} from "@/lib/programs/program-display-labels"
import type { ProgramKind } from "@/lib/programs/program-kind"
import { normalizeProgramKind } from "@/lib/programs/program-kind"
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
  const [yearName, setYearName] = useState<string | null>(null)
  const [yearProgramKind, setYearProgramKind] = useState<ProgramKind | null>(
    null
  )
  const stickyChromeRef = useRef<HTMLDivElement>(null)
  const [stickyChromeHeight, setStickyChromeHeight] = useState(0)

  const returnTo = searchParams.get(RETURN_TO_QUERY_PARAM)
  const rawTab = searchParams.get("tab")
  const activeTab = parseDepartmentWorkspaceTab(rawTab)
  const yearProgramId = searchParams.get("year")
  const financeSection = parseDepartmentFinanceSection(
    rawTab,
    searchParams.get("section")
  )
  const scheduleSection = parseDepartmentScheduleSection(
    rawTab,
    searchParams.get("section")
  )
  const studentsSection = parseDepartmentStudentsSection(
    rawTab,
    searchParams.get("section")
  )

  const safeReturnTo =
    returnTo && isSafeReturnToPath(returnTo) ? returnTo : undefined

  const backHref =
    entryPoint === "donations"
      ? donationGroupGivingListHref(
          safeReturnTo || DONATIONS_GROUP_GIVING_REPORT_PATH
        )
      : safeReturnTo || WORKFORCE_DEPARTMENTS_PATH

  const backLabel = entryPoint === "donations" ? "Group Giving" : "Departments"

  const hasGivingPreview = Boolean(pair?.groupContactId)
  const resolvedTabPreview: GroupWorkspaceTab =
    !hasGivingPreview && activeTab === "group-giving" ? "overview" : activeTab
  const yearModePreview =
    Boolean(yearProgramId) && isDepartmentYearWorkspaceTab(resolvedTabPreview)
  const showFinanceChromePreview =
    resolvedTabPreview === "financial" && !yearModePreview

  useLayoutEffect(() => {
    const el = stickyChromeRef.current
    if (!el) return
    const sync = () => setStickyChromeHeight(el.offsetHeight)
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    return () => observer.disconnect()
  }, [
    resolvedTabPreview,
    yearModePreview,
    hasGivingPreview,
    showFinanceChromePreview,
    loading,
    department,
  ])

  const financeStatsStickyTop =
    stickyChromeHeight > 0
      ? `calc(${STAFF_MAIN_CONTENT_STICKY_TOP_REM}rem + ${stickyChromeHeight}px)`
      : `${STAFF_MAIN_CONTENT_STICKY_TOP_REM}rem`

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

  useEffect(() => {
    if (!yearProgramId) {
      setYearName(null)
      setYearProgramKind(null)
      return
    }

    let cancelled = false
    void supabase
      .from("programs")
      .select("id, name, department_id, program_kind")
      .eq("id", yearProgramId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        if (!data || data.department_id !== departmentId) {
          setYearName(null)
          setYearProgramKind(null)
          return
        }
        const kind = normalizeProgramKind(
          (data as { program_kind?: string }).program_kind
        )
        setYearProgramKind(kind)
        setYearName(
          (data.name as string) || getHierarchyLabels(kind).containerSingular
        )
      })

    return () => {
      cancelled = true
    }
  }, [departmentId, supabase, yearProgramId])

  // Year-required tabs need `?year=`. Department tabs (including Programs) clear year.
  useEffect(() => {
    if (loading || !department) return

    if (isDepartmentYearRequiredTab(activeTab) && !yearProgramId) {
      router.replace(
        departmentGroupWorkspaceHref(departmentId, {
          tab: "overview",
          returnTo: safeReturnTo,
        }),
        { scroll: false }
      )
      return
    }

    if (!isDepartmentYearWorkspaceTab(activeTab) && yearProgramId) {
      router.replace(
        departmentGroupWorkspaceHref(departmentId, {
          tab: activeTab === "group-giving" && !pair ? "overview" : activeTab,
          finance: activeTab === "financial" ? financeSection : undefined,
          scheduleSection:
            activeTab === "schedule" ? scheduleSection : undefined,
          returnTo: safeReturnTo,
        }),
        { scroll: false }
      )
    }
  }, [
    activeTab,
    department,
    departmentId,
    financeSection,
    loading,
    pair,
    router,
    safeReturnTo,
    scheduleSection,
    yearProgramId,
  ])

  function handleTabChange(tab: string) {
    const next = parseDepartmentWorkspaceTab(tab)
    const hasGiving = Boolean(pair?.groupContactId)
    const safeTab = !hasGiving && next === "group-giving" ? "overview" : next

    if (isDepartmentYearRequiredTab(safeTab)) {
      if (!yearProgramId) {
        router.replace(
          departmentGroupWorkspaceHref(departmentId, {
            tab: "overview",
            returnTo: safeReturnTo,
          }),
          { scroll: false }
        )
        return
      }
      router.replace(
        departmentGroupWorkspaceHref(departmentId, {
          tab: safeTab,
          finance: safeTab === "financial" ? financeSection : undefined,
          studentsSection: safeTab === "students" ? studentsSection : undefined,
          yearProgramId,
          returnTo: safeReturnTo,
        }),
        { scroll: false }
      )
      return
    }

    // Dual-purpose: keep year when already in year workspace.
    if (
      (safeTab === "programs" || safeTab === "overview") &&
      yearProgramId
    ) {
      router.replace(
        departmentGroupWorkspaceHref(departmentId, {
          tab: safeTab,
          yearProgramId,
          returnTo: safeReturnTo,
        }),
        { scroll: false }
      )
      return
    }

    router.replace(
      departmentGroupWorkspaceHref(departmentId, {
        tab: safeTab,
        finance: safeTab === "financial" ? financeSection : undefined,
        scheduleSection: safeTab === "schedule" ? scheduleSection : undefined,
        returnTo: safeReturnTo,
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
        returnTo: safeReturnTo,
      }),
      { scroll: false }
    )
  }

  function handleScheduleSectionChange(section: string) {
    const next = parseDepartmentScheduleSection("schedule", section)
    router.replace(
      departmentGroupWorkspaceHref(departmentId, {
        tab: "schedule",
        scheduleSection: next,
        returnTo: safeReturnTo,
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
        yearProgramId: yearProgramId || undefined,
        returnTo: safeReturnTo,
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
  const yearMode =
    Boolean(yearProgramId) && isDepartmentYearWorkspaceTab(resolvedTab)

  const departmentOverviewHref = departmentGroupWorkspaceHref(departmentId, {
    tab: "overview",
    returnTo: safeReturnTo,
  })
  const departmentProgramsHref = departmentGroupWorkspaceHref(departmentId, {
    tab: "programs",
    returnTo: safeReturnTo,
  })

  const yearLabels = getHierarchyLabels(yearProgramKind)
  const breadcrumbExtras = yearMode
    ? [
        { label: displayName, href: departmentOverviewHref },
        { label: yearLabels.containerPlural, href: departmentProgramsHref },
        { label: yearName || yearLabels.containerSingular },
      ]
    : [{ label: displayName }]

  const headerTitle = yearMode ? yearName || displayName : displayName
  const showFinanceChrome = resolvedTab === "financial" && !yearMode

  return (
    <>
      <Header title={headerTitle} breadcrumbExtras={breadcrumbExtras} />
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            {yearMode ? (
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {yearName || yearLabels.containerSingular}
                </h1>
                <Badge variant="outline" className="font-normal">
                  {yearLabels.containerSingular}
                </Badge>
              </div>
            ) : (
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
            )}
          </div>
          {!yearMode && groupEdit ? (
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Edit group
            </Button>
          ) : null}
        </div>

        <div
          ref={stickyChromeRef}
          className={cn(
            "sticky z-40 -mx-6 space-y-3 border-b border-border bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/90",
            STAFF_MAIN_CONTENT_STICKY_TOP_CLASS
          )}
        >
          <Tabs value={resolvedTab} onValueChange={handleTabChange} className="gap-0">
            <TabsList className="flex h-auto flex-wrap justify-start gap-1">
              {yearMode ? (
                <>
                  <TabsTrigger value="overview" className="gap-2">
                    <LayoutDashboard className="size-4" />
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="programs" className="gap-2">
                    <BookOpen className="size-4" />
                    {yearLabels.offeringPlural}
                  </TabsTrigger>
                  <TabsTrigger value="students" className="gap-2">
                    <Users className="size-4" />
                    Registrations
                  </TabsTrigger>
                </>
              ) : (
                <>
                  <TabsTrigger value="overview" className="gap-2">
                    <LayoutDashboard className="size-4" />
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="programs" className="gap-2">
                    <BookOpen className="size-4" />
                    {YEAR_SEASON_LABEL_PLURAL}
                  </TabsTrigger>
                  <TabsTrigger value="schedule" className="gap-2">
                    <CalendarClock className="size-4" />
                    Schedule
                  </TabsTrigger>
                  <TabsTrigger value="financial" className="gap-2">
                    <PieChart className="size-4" />
                    Financial
                  </TabsTrigger>
                  <TabsTrigger value="reports" className="gap-2">
                    <BarChart3 className="size-4" />
                    Reports
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
                </>
              )}
            </TabsList>
          </Tabs>

          {showFinanceChrome ? (
            <Tabs
              value={financeSection}
              onValueChange={handleFinanceSectionChange}
              className="gap-0"
            >
              <TabsList className="flex h-auto flex-wrap justify-start gap-1">
                <TabsTrigger value="employees" className="gap-2">
                  <Users className="size-4" />
                  Employees
                </TabsTrigger>
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
          ) : null}
        </div>

        {resolvedTab === "overview" && !yearProgramId ? (
          <DepartmentOverviewPanel
            departmentId={department.id}
            departmentName={displayName}
            departmentDescription={department.description}
            departmentFlyerUrl={department.flyer_url}
            departmentColor={department.color}
            departmentTermsHtml={department.terms_html}
            departmentTermsPdfUrl={department.terms_pdf_url}
            onDepartmentMetaChanged={load}
          />
        ) : null}

        {resolvedTab === "overview" && yearProgramId ? (
          <DepartmentProgramOverviewPanel
            departmentId={department.id}
            yearProgramId={yearProgramId}
            onProgramMetaChanged={() => {
              // Refresh header year name after rename.
              void supabase
                .from("programs")
                .select("name")
                .eq("id", yearProgramId)
                .eq("department_id", departmentId)
                .maybeSingle()
                .then(({ data }) => {
                  if (data?.name) setYearName(data.name as string)
                })
            }}
          />
        ) : null}

        {resolvedTab === "programs" && !yearProgramId ? (
          <DepartmentProgramsCatalogPanel
            departmentId={department.id}
            departmentName={displayName}
          />
        ) : null}

        {resolvedTab === "programs" && yearProgramId ? (
          <DepartmentProgramsPanel
            departmentId={department.id}
            departmentName={displayName}
            initialYearProgramId={yearProgramId}
          />
        ) : null}

        {resolvedTab === "students" && yearProgramId ? (
          <DepartmentStudentsPanel
            departmentId={department.id}
            departmentName={displayName}
            initialSection={studentsSection}
            onSectionChange={handleStudentsSectionChange}
          />
        ) : null}

        {resolvedTab === "schedule" && !yearMode ? (
          <DepartmentSchedulePanel
            departmentId={department.id}
            departmentName={displayName}
            initialSection={scheduleSection}
            onSectionChange={handleScheduleSectionChange}
          />
        ) : null}

        {resolvedTab === "financial" && !yearMode ? (
          <div className="space-y-4">
            {financeSection === "employees" ? (
              <DepartmentPayrollPanel
                departmentId={department.id}
                departmentName={displayName}
                staff={department.staff}
                onStaffChanged={load}
                stickyStatsTop={financeStatsStickyTop}
                variant="roster"
              />
            ) : null}

            {financeSection === "payroll" ? (
              <FinancePayrollQueuePanel
                departmentId={department.id}
                departmentName={displayName}
                stickyStatsTop={financeStatsStickyTop}
                employeeCount={department.staff.length}
                compactStats
                actions={
                  <DepartmentPayrollPanel
                    departmentId={department.id}
                    departmentName={displayName}
                    staff={department.staff}
                    onStaffChanged={load}
                    variant="periods"
                  />
                }
              />
            ) : null}

            {financeSection === "expenses" ? (
              <DepartmentExpensesPanel
                departmentId={department.id}
                departmentName={displayName}
                stickyStatsTop={financeStatsStickyTop}
              />
            ) : null}

            {financeSection === "budget" ? (
              <DepartmentBudgetPanel
                departmentId={department.id}
                departmentName={displayName}
                stickyStatsTop={financeStatsStickyTop}
              />
            ) : null}
          </div>
        ) : null}

        {resolvedTab === "reports" && !yearMode ? (
          <DepartmentReportsPanel
            departmentId={department.id}
            departmentName={displayName}
            staff={department.staff}
            onStaffChanged={load}
          />
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
