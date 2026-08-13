"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ArrowLeft, CalendarDays, UserRound, Users } from "lucide-react"

import { OfferingEditDialog } from "@/components/programs/offering-edit-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import { Switch } from "@/components/ui/switch"
import type { OfferingManageSummary } from "@/lib/programs/offering-manage-summary"
import {
  formatOfferingSessionDateLabel,
  type OfferingSessionEnrollmentSummary,
  type OfferingSessionRoster,
} from "@/lib/programs/offering-session-enrollment-types"
import { getOfferingScheduleSummaryLines } from "@/lib/programs/offering-schedule-summary"
import type { OfferingWorkspaceData } from "@/lib/programs/offering-workspace-types"
import type { ProgramCapacityGroupInput } from "@/lib/programs/program-capacity-group-types"
import {
  formatOfferingEnrollmentLabel,
  formatOfferingPerSessionCapacityHint,
} from "@/lib/programs/program-catalog-capacity"
import {
  PROGRAM_OFFERING_STATUS_LABELS,
  type ProgramOffering,
} from "@/lib/programs/program-offering-types"
import { programOfferingManageHref } from "@/lib/programs/program-offering-paths"
import { setSelectedSessionsOpen } from "@/lib/programs/selected-sessions-priority-actions"
import type { Program } from "@/lib/programs/program-types"
import { isSeasonalProgramKind } from "@/lib/programs/program-kind"
import { cn } from "@/lib/utils"

export type OfferingManageNavigationContext = {
  mode: "department" | "programs"
  departmentId?: string
  departmentName?: string | null
  /** Back to department Programs tab (or catalog). */
  backHref: string
  /** Departments list / department detail when mode is department. */
  departmentsListHref?: string
}

function getPrimaryInstructorLabel(
  workspaceData: OfferingWorkspaceData
): string {
  const active = workspaceData.staffAssignments.filter(
    (row) => row.is_active !== false
  )
  const offeringLevel = active.filter((row) => row.session_id == null)
  const pool = offeringLevel.length > 0 ? offeringLevel : active
  const primary = pool.find(
    (row) => row.assignment_role === "primary_instructor"
  )
  if (primary?.contact_name) return primary.contact_name
  const instructor = pool.find(
    (row) =>
      row.assignment_role === "assistant_instructor" ||
      String(row.assignment_role) === "instructor"
  )
  if (instructor?.contact_name) return instructor.contact_name
  return "Unassigned"
}

export function OfferingManageClient({
  program,
  departmentName,
  selectedOffering: initialSelected,
  workspaceData: initialWorkspaceData,
  capacityGroups: initialCapacityGroups,
  summary: initialSummary,
  navigationContext,
  enrolledNames = [],
  sessionEnrollment = null,
  sessionRoster = null,
  initialEditOpen = false,
}: {
  program: Program
  departmentName: string | null
  selectedOffering: ProgramOffering
  workspaceData: OfferingWorkspaceData
  capacityGroups: ProgramCapacityGroupInput[]
  summary: OfferingManageSummary
  navigationContext?: OfferingManageNavigationContext
  enrolledNames?: string[]
  sessionEnrollment?: OfferingSessionEnrollmentSummary | null
  sessionRoster?: OfferingSessionRoster | null
  initialEditOpen?: boolean
  /** @deprecated Use summary.enrolled */
  enrolled?: number
  /** @deprecated Tabs removed; edit opens in dialog */
  initialTab?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [selected, setSelected] = React.useState(initialSelected)
  const [workspaceData, setWorkspaceData] = React.useState(initialWorkspaceData)
  const [capacityGroups, setCapacityGroups] = React.useState(
    initialCapacityGroups
  )
  const [summary, setSummary] = React.useState(initialSummary)
  const [editOpen, setEditOpen] = React.useState(initialEditOpen)
  const [selectedSessionsOpen, setSelectedSessionsOpenState] = React.useState(
    initialSelected.selected_sessions_open !== false
  )
  const [priorityBusy, setPriorityBusy] = React.useState(false)
  const [priorityMessage, setPriorityMessage] = React.useState<string | null>(
    null
  )

  React.useEffect(() => {
    setSelected(initialSelected)
    setWorkspaceData(initialWorkspaceData)
    setCapacityGroups(initialCapacityGroups)
    setSummary(initialSummary)
    setSelectedSessionsOpenState(
      initialSelected.selected_sessions_open !== false
    )
  }, [
    initialSelected,
    initialWorkspaceData,
    initialCapacityGroups,
    initialSummary,
  ])

  React.useEffect(() => {
    if (initialEditOpen) setEditOpen(true)
  }, [initialEditOpen])

  const nav = navigationContext ?? {
    mode: "programs" as const,
    backHref: "/programs/catalog",
  }

  const seasonalMode = isSeasonalProgramKind(program.program_kind)
  const hasSessions = (sessionEnrollment?.sessions.length || 0) > 0
  const enrollmentLabel = formatOfferingEnrollmentLabel(
    summary.enrolled,
    selected,
    { capacityAppliesPerSession: hasSessions }
  )
  const perSessionCapacityHint = formatOfferingPerSessionCapacityHint(selected)
  const offeringCapacity =
    selected.capacity_mode === "limited"
      ? Math.max(0, Number(selected.capacity || 0))
      : null
  const instructorLabel = getPrimaryInstructorLabel(workspaceData)
  const scheduleLines = getOfferingScheduleSummaryLines(
    workspaceData.scheduleItems,
    workspaceData.venues
  )
  const scheduleValue = scheduleLines ? (
    <div className="space-y-0.5 text-sm font-normal leading-snug">
      {scheduleLines.days ? <p>{scheduleLines.days}</p> : null}
      {scheduleLines.time ? <p>{scheduleLines.time}</p> : null}
      {scheduleLines.location ? <p>{scheduleLines.location}</p> : null}
    </div>
  ) : (
    <span className="text-sm font-normal">No schedule set</span>
  )

  const offeringHref = programOfferingManageHref(program.id, selected.id, {
    departmentId: nav.departmentId ?? program.department_id,
  })

  const showCampRollups =
    (sessionEnrollment?.camp1Unique || 0) > 0 ||
    (sessionEnrollment?.camp2Unique || 0) > 0

  const enrollmentHint =
    summary.waitlistCount > 0
      ? `Waitlist: ${summary.waitlistCount}`
      : hasSessions && perSessionCapacityHint
        ? perSessionCapacityHint
        : offeringCapacity != null
          ? enrollmentLabel
          : "Unlimited capacity"

  function clearEditQueryParam() {
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    if (!url.searchParams.has("edit")) return
    url.searchParams.delete("edit")
    const query = url.searchParams.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  function handleEditOpenChange(open: boolean) {
    setEditOpen(open)
    if (!open) clearEditQueryParam()
  }

  const subtitle = seasonalMode
    ? departmentName
      ? `Seasonal camp · ${departmentName}`
      : "Seasonal camp"
    : `${program.name}${departmentName ? ` · ${departmentName}` : ""}`

  return (
    <div className="flex flex-col bg-slate-50/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="text-left text-3xl font-semibold tracking-tight text-sky-700 hover:text-sky-800 hover:underline"
            >
              {selected.name}
            </button>
            <Badge
              variant="secondary"
              className={cn(
                "gap-1.5 rounded-full",
                selected.status === "active"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-zinc-200 bg-zinc-100 text-zinc-600"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  selected.status === "active" ? "bg-emerald-500" : "bg-zinc-400"
                )}
              />
              {PROGRAM_OFFERING_STATUS_LABELS[selected.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>

        <StatCardsRow equal columns={3}>
          <StatCard
            fill
            tone="sky"
            layout="header"
            icon={UserRound}
            label="Primary instructor"
            value={instructorLabel}
            valueClassName="text-base font-normal"
          />
          <StatCard
            fill
            tone="violet"
            layout="header"
            icon={CalendarDays}
            label="Schedule"
            value={scheduleValue}
            valueClassName="text-base font-normal"
          />
          <StatCard
            fill
            tone="emerald"
            layout="header"
            icon={Users}
            label="Enrollment"
            value={`${summary.enrolled} enrolled`}
            valueClassName="text-base font-normal"
            hint={enrollmentHint}
          />
        </StatCardsRow>

        {sessionRoster ? (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <Button variant="ghost" size="sm" className="-ml-2 h-8 px-2" asChild>
                  <Link href={offeringHref}>
                    <ArrowLeft className="mr-1.5 h-4 w-4" />
                    All sessions
                  </Link>
                </Button>
                <h2 className="text-base font-semibold text-slate-900">
                  {sessionRoster.session.name}
                  {sessionRoster.session.campLabel
                    ? ` · ${sessionRoster.session.campLabel}`
                    : ""}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {formatOfferingSessionDateLabel(
                    sessionRoster.session.startDate,
                    sessionRoster.session.endDate
                  ) || "Session roster"}
                  {" · "}
                  {sessionRoster.participants.length} enrolled
                  {sessionRoster.session.capacity > 0
                    ? ` / ${sessionRoster.session.capacity} capacity`
                    : ""}
                </p>
              </div>
            </div>
            {sessionRoster.participants.length === 0 ? (
              <p className="rounded-md border border-dashed bg-white px-4 py-8 text-center text-sm text-muted-foreground">
                No students have access to this session.
              </p>
            ) : (
              <ul className="divide-y rounded-md border bg-white">
                {sessionRoster.participants.map((row) => (
                  <li
                    key={row.enrollmentId}
                    className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm text-slate-800"
                  >
                    <span>{row.childName}</span>
                    {row.childAge != null ? (
                      <span className="text-xs text-muted-foreground">
                        Age {row.childAge}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : (
          <>
            {sessionEnrollment && sessionEnrollment.sessions.length > 0 ? (
              <section className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold text-slate-900">
                      Session enrollment
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Headcount by week. Offering total ({summary.enrolled}) counts
                      each child once; week totals count who has access that week.
                    </p>
                  </div>
                  <div className="rounded-md border bg-white px-3 py-2">
                    <div className="flex items-center gap-3">
                      <div className="space-y-0.5">
                        <Label
                          htmlFor="accept-selected-weeks"
                          className="text-sm font-medium"
                        >
                          Accept selected weeks
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {selectedSessionsOpen
                            ? "Selected weeks can enroll; waitlist auto-fills"
                            : "Full Camp 1 / Camp 2 only — selected weeks waitlist"}
                        </p>
                      </div>
                      <Switch
                        id="accept-selected-weeks"
                        checked={selectedSessionsOpen}
                        disabled={priorityBusy}
                        onCheckedChange={async (checked) => {
                          setPriorityBusy(true)
                          setPriorityMessage(null)
                          try {
                            const result = await setSelectedSessionsOpen({
                              programId: program.id,
                              offeringId: selected.id,
                              open: checked,
                            })
                            setSelectedSessionsOpenState(checked)
                            setSelected((prev) => ({
                              ...prev,
                              selected_sessions_open: checked,
                            }))
                            if (checked) {
                              setPriorityMessage(
                                result.promoted > 0
                                  ? `Opened selected weeks. Promoted ${result.promoted} from waitlist.`
                                  : "Opened selected weeks. No waitlist rows could be placed yet."
                              )
                            } else {
                              setPriorityMessage(
                                "Full camp priority on. Selected weeks will waitlist."
                              )
                            }
                            router.refresh()
                          } catch (error) {
                            setPriorityMessage(
                              error instanceof Error
                                ? error.message
                                : "Failed to update selected-weeks setting."
                            )
                          } finally {
                            setPriorityBusy(false)
                          }
                        }}
                      />
                    </div>
                    {priorityMessage ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {priorityMessage}
                      </p>
                    ) : null}
                  </div>
                </div>

                {showCampRollups ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-md border bg-white px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Camp 1
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">
                        {sessionEnrollment.camp1Unique}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Unique kids · Weeks 1–4
                      </p>
                    </div>
                    <div className="rounded-md border bg-white px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Camp 2
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">
                        {sessionEnrollment.camp2Unique}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Unique kids · Weeks 5–8
                      </p>
                    </div>
                    <div className="rounded-md border bg-white px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Both camps
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">
                        {sessionEnrollment.bothCampsUnique}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Signed up for Camp 1 and 2
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="overflow-hidden rounded-md border bg-white">
                  <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>Session</span>
                    <span>Dates</span>
                    <span className="text-right">Enrolled</span>
                  </div>
                  <ul className="divide-y">
                    {sessionEnrollment.sessions.map((session) => {
                      const href = programOfferingManageHref(
                        program.id,
                        selected.id,
                        {
                          departmentId:
                            nav.departmentId ?? program.department_id,
                          sessionId: session.sessionId,
                        }
                      )
                      const capacityLabel =
                        session.capacity > 0
                          ? `${session.enrolled} / ${session.capacity}`
                          : `${session.enrolled}`
                      return (
                        <li key={session.sessionId}>
                          <Link
                            href={href}
                            className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-sm hover:bg-muted/40"
                          >
                            <span className="min-w-0">
                              <span className="font-medium text-sky-700">
                                {session.name}
                              </span>
                              {session.campLabel ? (
                                <Badge
                                  variant="outline"
                                  className="ml-2 font-normal"
                                >
                                  {session.campLabel}
                                </Badge>
                              ) : null}
                            </span>
                            <span className="text-muted-foreground">
                              {formatOfferingSessionDateLabel(
                                session.startDate,
                                session.endDate
                              ) || "—"}
                            </span>
                            <span className="text-right font-medium tabular-nums">
                              {capacityLabel}
                              <span className="ml-2 text-xs font-normal text-sky-700">
                                View
                              </span>
                            </span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </section>
            ) : null}

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-slate-900">
                Enrolled students
              </h2>
              {enrolledNames.length === 0 ? (
                <p className="rounded-md border border-dashed bg-white px-4 py-8 text-center text-sm text-muted-foreground">
                  No students enrolled yet.
                </p>
              ) : (
                <ul className="divide-y rounded-md border bg-white">
                  {enrolledNames.map((name, index) => (
                    <li
                      key={`${name}-${index}`}
                      className="px-4 py-2.5 text-sm text-slate-800"
                    >
                      {name}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>

      <OfferingEditDialog
        open={editOpen}
        onOpenChange={handleEditOpenChange}
        program={program}
        offering={selected}
        departmentId={nav.departmentId ?? program.department_id}
        departmentName={nav.departmentName || departmentName}
        workspaceData={workspaceData}
        capacityGroups={capacityGroups}
        summary={summary}
        onSaved={(updated) => {
          setSelected(updated)
        }}
      />
    </div>
  )
}
