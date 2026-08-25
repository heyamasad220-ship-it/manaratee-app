"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { AlertCircle, ClipboardList, Users } from "lucide-react"

import { DepartmentApplicationsPanel } from "@/components/departments/department-applications-panel"
import { DepartmentParticipantsPanel } from "@/components/departments/department-participants-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import type { DepartmentStudentsSection } from "@/lib/donations/donation-group-path"
import { isApplicationBasedProgram } from "@/lib/programs/enrollment-process"
import type { ApplicationStatusChip } from "@/lib/programs/program-application-types"
import {
  fetchProgramRegistrationMetricsAction,
  type ProgramRegistrationMetrics,
} from "@/lib/programs/program-registration-metrics"
import type { Program } from "@/lib/programs/program-types"
import { cn } from "@/lib/utils"

type DepartmentStudentsPanelProps = {
  departmentId: string
  departmentName: string
  program?: Program | null
  /** From URL `section`, or null to auto-pick Applications when pending. */
  initialSection?: DepartmentStudentsSection | null
  onSectionChange?: (section: DepartmentStudentsSection) => void
}

const EMPTY_METRICS: ProgramRegistrationMetrics = {
  needsReview: 0,
  awaitingEvaluation: 0,
  approvedPending: 0,
  enrolled: 0,
  balanceDue: 0,
  pendingCheckout: 0,
  waitlisted: 0,
  cancelled: 0,
  applicationChipCounts: {
    all: 0,
    needs_review: 0,
    evaluation: 0,
    approved: 0,
    waitlisted: 0,
    declined: 0,
  },
}

function MetricButton({
  metric,
  onSelect,
  children,
}: {
  metric: string
  onSelect: (metric: string) => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className="min-w-0 w-full text-left"
      onClick={() => onSelect(metric)}
    >
      {children}
    </button>
  )
}

export function DepartmentStudentsPanel({
  departmentId,
  departmentName,
  program = null,
  initialSection = null,
  onSectionChange,
}: DepartmentStudentsPanelProps) {
  const applicationBased = isApplicationBasedProgram(program)
  const [stage, setStage] = useState<DepartmentStudentsSection>(
    initialSection ?? "enrollments"
  )
  const [metrics, setMetrics] =
    useState<ProgramRegistrationMetrics>(EMPTY_METRICS)
  const [applicationChip, setApplicationChip] =
    useState<ApplicationStatusChip>("all")
  const didAutoPick = useRef(initialSection != null)

  const loadCounts = useCallback(async () => {
    const result = await fetchProgramRegistrationMetricsAction(
      departmentId,
      program?.id ?? null
    )
    if (!result.success) return

    setMetrics(result.metrics)

    if (!didAutoPick.current && initialSection == null) {
      didAutoPick.current = true
      setStage(
        applicationBased && result.metrics.needsReview > 0
          ? "applications"
          : "enrollments"
      )
    }
  }, [departmentId, program?.id, initialSection, applicationBased])

  useEffect(() => {
    void loadCounts()
  }, [loadCounts])

  useEffect(() => {
    if (initialSection) {
      didAutoPick.current = true
      setStage(initialSection)
      return
    }
    if (!applicationBased) {
      setStage("enrollments")
    }
  }, [initialSection, applicationBased])

  function selectStage(next: DepartmentStudentsSection) {
    didAutoPick.current = true
    setStage(next)
    onSectionChange?.(next)
  }

  function handleMetricClick(metric: string) {
    if (metric === "needs-review") {
      selectStage("applications")
      setApplicationChip("needs_review")
      return
    }
    if (metric === "evaluation") {
      selectStage("applications")
      setApplicationChip("evaluation")
      return
    }
    if (metric === "approved-pending") {
      selectStage("applications")
      setApplicationChip("approved")
      return
    }
    selectStage("enrollments")
  }

  const stageTabs = applicationBased ? (
    <div className="inline-flex h-auto flex-wrap gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1">
      {(
        [
          { id: "applications" as const, label: "Applications" },
          { id: "enrollments" as const, label: "Enrollments" },
        ]
      ).map((item) => {
        const count =
          item.id === "applications"
            ? metrics.needsReview + metrics.awaitingEvaluation
            : null
        const active = stage === item.id
        return (
          <Button
            key={item.id}
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 gap-2 rounded-md px-3 text-zinc-600 hover:bg-amber-50/70 hover:text-amber-700",
              active && "bg-amber-50 text-amber-700"
            )}
            onClick={() => selectStage(item.id)}
          >
            {item.label}
            {count != null && count > 0 ? (
              <Badge variant="secondary" className="font-normal">
                {count}
              </Badge>
            ) : null}
          </Button>
        )
      })}
    </div>
  ) : null

  return (
    <div className="space-y-4">
      {applicationBased ? (
        <StatCardsRow equal columns={5} className="gap-3">
          <MetricButton metric="needs-review" onSelect={handleMetricClick}>
            <StatCard
              layout="compact"
              fill
              tone="amber"
              label="Needs Review"
              value={metrics.needsReview}
              icon={ClipboardList}
              valueClassName="text-xl"
            />
          </MetricButton>
          <MetricButton metric="evaluation" onSelect={handleMetricClick}>
            <StatCard
              layout="compact"
              fill
              tone="sky"
              label="Awaiting Evaluation"
              value={metrics.awaitingEvaluation}
              icon={ClipboardList}
              valueClassName="text-xl"
            />
          </MetricButton>
          <MetricButton metric="approved-pending" onSelect={handleMetricClick}>
            <StatCard
              layout="compact"
              fill
              tone="violet"
              label="Approved — Registration Pending"
              value={metrics.approvedPending}
              icon={AlertCircle}
              valueClassName="text-xl"
            />
          </MetricButton>
          <MetricButton metric="enrolled" onSelect={handleMetricClick}>
            <StatCard
              layout="compact"
              fill
              tone="emerald"
              label="Enrolled"
              value={metrics.enrolled}
              icon={Users}
              valueClassName="text-xl"
            />
          </MetricButton>
          <MetricButton metric="balance-due" onSelect={handleMetricClick}>
            <StatCard
              layout="compact"
              fill
              tone="orange"
              label="Balance Due"
              value={metrics.balanceDue}
              icon={AlertCircle}
              valueClassName="text-xl"
            />
          </MetricButton>
        </StatCardsRow>
      ) : (
        <StatCardsRow equal columns={5} className="gap-3">
          <MetricButton metric="enrolled" onSelect={handleMetricClick}>
            <StatCard
              layout="compact"
              fill
              tone="emerald"
              label="Enrolled"
              value={metrics.enrolled}
              icon={Users}
              valueClassName="text-xl"
            />
          </MetricButton>
          <MetricButton metric="pending" onSelect={handleMetricClick}>
            <StatCard
              layout="compact"
              fill
              tone="amber"
              label="Pending Checkout"
              value={metrics.pendingCheckout}
              icon={AlertCircle}
              valueClassName="text-xl"
            />
          </MetricButton>
          <MetricButton metric="balance-due" onSelect={handleMetricClick}>
            <StatCard
              layout="compact"
              fill
              tone="orange"
              label="Balance Due"
              value={metrics.balanceDue}
              icon={AlertCircle}
              valueClassName="text-xl"
            />
          </MetricButton>
          <MetricButton metric="waitlisted" onSelect={handleMetricClick}>
            <StatCard
              layout="compact"
              fill
              tone="sky"
              label="Waitlisted"
              value={metrics.waitlisted}
              icon={Users}
              valueClassName="text-xl"
            />
          </MetricButton>
          <MetricButton metric="cancelled" onSelect={handleMetricClick}>
            <StatCard
              layout="compact"
              fill
              tone="slate"
              label="Cancelled"
              value={metrics.cancelled}
              icon={Users}
              valueClassName="text-xl"
            />
          </MetricButton>
        </StatCardsRow>
      )}

      <DepartmentParticipantsPanel
        departmentId={departmentId}
        departmentName={departmentName}
        programId={program?.id ?? null}
        embedded
        showKpis={false}
        stageNav={stageTabs}
        showRoster={stage === "enrollments"}
        alternateContent={
          applicationBased && stage === "applications" ? (
            <DepartmentApplicationsPanel
              departmentId={departmentId}
              departmentName={departmentName}
              programId={program?.id ?? null}
              filter="all"
              statusChip={applicationChip}
              onStatusChipChange={setApplicationChip}
              chipCounts={metrics.applicationChipCounts}
              evaluationRequired={Boolean(program?.evaluation_required)}
              embedded
              onCountsMayHaveChanged={() => void loadCounts()}
            />
          ) : null
        }
      />
    </div>
  )
}
