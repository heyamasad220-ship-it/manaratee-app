"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertCircle, ClipboardList, Users } from "lucide-react"

import { DepartmentApplicationsPanel } from "@/components/departments/department-applications-panel"
import { DepartmentParticipantsPanel } from "@/components/departments/department-participants-panel"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import { isApplicationBasedProgram } from "@/lib/programs/enrollment-process"
import type { ApplicationStatusChip } from "@/lib/programs/program-application-types"
import {
  fetchProgramRegistrationMetricsAction,
  type ProgramRegistrationMetrics,
} from "@/lib/programs/program-registration-metrics"
import type { Program } from "@/lib/programs/program-types"
import {
  parseRegistrationStatusParam,
  programWorkspaceHref,
  type RegistrationStatusFilter,
} from "@/lib/programs/program-workspace-path"

type DepartmentStudentsPanelView = "applications" | "enrollments"

type DepartmentStudentsPanelProps = {
  departmentId: string
  departmentName: string
  program?: Program | null
  view?: DepartmentStudentsPanelView
}

const EMPTY_METRICS: ProgramRegistrationMetrics = {
  evaluation: 0,
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
    withdrawn: 0,
  },
}

function MetricButton({
  metric,
  selected,
  onSelect,
  children,
}: {
  metric: string
  selected?: boolean
  onSelect: (metric: string) => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className="min-w-0 w-full text-left"
      aria-pressed={selected}
      onClick={() => onSelect(metric)}
    >
      {children}
    </button>
  )
}

function selectedCardClass(selected: boolean) {
  return selected ? "ring-2 ring-primary/40 ring-offset-2" : undefined
}

export function DepartmentStudentsPanel({
  departmentId,
  departmentName,
  program = null,
  view = "enrollments",
}: DepartmentStudentsPanelProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const applicationBased = isApplicationBasedProgram(program)
  const [metrics, setMetrics] =
    useState<ProgramRegistrationMetrics>(EMPTY_METRICS)
  const [applicationChip, setApplicationChip] =
    useState<ApplicationStatusChip>("all")

  const selectedStatus: RegistrationStatusFilter =
    parseRegistrationStatusParam(searchParams.get("status")) ?? "active"
  const offeringId = searchParams.get("offering") || undefined

  const loadCounts = useCallback(async () => {
    const result = await fetchProgramRegistrationMetricsAction(
      departmentId,
      program?.id ?? null
    )
    if (!result.success) return
    setMetrics(result.metrics)
  }, [departmentId, program?.id])

  useEffect(() => {
    void loadCounts()
  }, [loadCounts])

  function handleApplicationMetricClick(metric: string) {
    if (metric === "evaluation") {
      setApplicationChip("evaluation")
      return
    }
    if (metric === "approved-pending") {
      setApplicationChip("approved")
    }
  }

  function handleRegistrationMetricClick(metric: RegistrationStatusFilter) {
    if (!program?.id) return
    const nextStatus = selectedStatus === metric ? "all" : metric
    router.replace(
      programWorkspaceHref(program.id, {
        tab: "students",
        registrationStatus: nextStatus,
        offeringId,
      }),
      { scroll: false }
    )
  }

  if (view === "applications") {
    return (
      <div className="space-y-4">
        <StatCardsRow equal columns={2} className="gap-3">
          <MetricButton
            metric="evaluation"
            onSelect={handleApplicationMetricClick}
          >
            <StatCard
              layout="compact"
              fill
              tone="amber"
              label="Pending"
              value={metrics.evaluation}
              icon={ClipboardList}
              valueClassName="text-xl"
            />
          </MetricButton>
          <MetricButton
            metric="approved-pending"
            onSelect={handleApplicationMetricClick}
          >
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
        </StatCardsRow>

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
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {applicationBased ? (
        <StatCardsRow equal columns={3} className="gap-3">
          <MetricButton
            metric="active"
            selected={selectedStatus === "active"}
            onSelect={(metric) =>
              handleRegistrationMetricClick(metric as RegistrationStatusFilter)
            }
          >
            <StatCard
              layout="compact"
              fill
              tone="emerald"
              label="Enrolled"
              value={metrics.enrolled}
              icon={Users}
              valueClassName="text-xl"
              className={selectedCardClass(selectedStatus === "active")}
            />
          </MetricButton>
          <MetricButton
            metric="waitlisted"
            selected={selectedStatus === "waitlisted"}
            onSelect={(metric) =>
              handleRegistrationMetricClick(metric as RegistrationStatusFilter)
            }
          >
            <StatCard
              layout="compact"
              fill
              tone="sky"
              label="Waitlisted"
              value={metrics.waitlisted}
              icon={Users}
              valueClassName="text-xl"
              className={selectedCardClass(selectedStatus === "waitlisted")}
            />
          </MetricButton>
          <MetricButton
            metric="cancelled"
            selected={selectedStatus === "cancelled"}
            onSelect={(metric) =>
              handleRegistrationMetricClick(metric as RegistrationStatusFilter)
            }
          >
            <StatCard
              layout="compact"
              fill
              tone="slate"
              label="Cancelled"
              value={metrics.cancelled}
              icon={Users}
              valueClassName="text-xl"
              className={selectedCardClass(selectedStatus === "cancelled")}
            />
          </MetricButton>
        </StatCardsRow>
      ) : (
        <StatCardsRow equal columns={4} className="gap-3">
          <MetricButton
            metric="active"
            selected={selectedStatus === "active"}
            onSelect={(metric) =>
              handleRegistrationMetricClick(metric as RegistrationStatusFilter)
            }
          >
            <StatCard
              layout="compact"
              fill
              tone="emerald"
              label="Enrolled"
              value={metrics.enrolled}
              icon={Users}
              valueClassName="text-xl"
              className={selectedCardClass(selectedStatus === "active")}
            />
          </MetricButton>
          <MetricButton
            metric="pending"
            selected={selectedStatus === "pending"}
            onSelect={(metric) =>
              handleRegistrationMetricClick(metric as RegistrationStatusFilter)
            }
          >
            <StatCard
              layout="compact"
              fill
              tone="amber"
              label="Pending Checkout"
              value={metrics.pendingCheckout}
              icon={AlertCircle}
              valueClassName="text-xl"
              className={selectedCardClass(selectedStatus === "pending")}
            />
          </MetricButton>
          <MetricButton
            metric="waitlisted"
            selected={selectedStatus === "waitlisted"}
            onSelect={(metric) =>
              handleRegistrationMetricClick(metric as RegistrationStatusFilter)
            }
          >
            <StatCard
              layout="compact"
              fill
              tone="sky"
              label="Waitlisted"
              value={metrics.waitlisted}
              icon={Users}
              valueClassName="text-xl"
              className={selectedCardClass(selectedStatus === "waitlisted")}
            />
          </MetricButton>
          <MetricButton
            metric="cancelled"
            selected={selectedStatus === "cancelled"}
            onSelect={(metric) =>
              handleRegistrationMetricClick(metric as RegistrationStatusFilter)
            }
          >
            <StatCard
              layout="compact"
              fill
              tone="slate"
              label="Cancelled"
              value={metrics.cancelled}
              icon={Users}
              valueClassName="text-xl"
              className={selectedCardClass(selectedStatus === "cancelled")}
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
        showRoster
      />
    </div>
  )
}
