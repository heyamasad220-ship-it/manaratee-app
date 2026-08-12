"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { CalendarDays, UserRound, Users } from "lucide-react"

import { OfferingEditDialog } from "@/components/programs/offering-edit-dialog"
import { Badge } from "@/components/ui/badge"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import type { OfferingManageSummary } from "@/lib/programs/offering-manage-summary"
import { getOfferingScheduleSummaryLines } from "@/lib/programs/offering-schedule-summary"
import type { OfferingWorkspaceData } from "@/lib/programs/offering-workspace-types"
import type { ProgramCapacityGroupInput } from "@/lib/programs/program-capacity-group-types"
import { formatOfferingEnrollmentLabel } from "@/lib/programs/program-catalog-capacity"
import {
  PROGRAM_OFFERING_STATUS_LABELS,
  type ProgramOffering,
} from "@/lib/programs/program-offering-types"
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

  React.useEffect(() => {
    setSelected(initialSelected)
    setWorkspaceData(initialWorkspaceData)
    setCapacityGroups(initialCapacityGroups)
    setSummary(initialSummary)
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
  const enrollmentLabel = formatOfferingEnrollmentLabel(
    summary.enrolled,
    selected
  )
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
            hint={
              summary.waitlistCount > 0
                ? `Waitlist: ${summary.waitlistCount}`
                : offeringCapacity != null
                  ? enrollmentLabel
                  : "Unlimited capacity"
            }
          />
        </StatCardsRow>

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
