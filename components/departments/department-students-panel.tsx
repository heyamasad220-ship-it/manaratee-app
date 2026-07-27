"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Users } from "lucide-react"

import { DepartmentApplicationsPanel } from "@/components/departments/department-applications-panel"
import { DepartmentParticipantsPanel } from "@/components/departments/department-participants-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { DepartmentStudentsSection } from "@/lib/donations/donation-group-path"
import { fetchDepartmentApplicationStageCountsAction } from "@/lib/programs/program-application-actions"
import { cn } from "@/lib/utils"

type DepartmentStudentsPanelProps = {
  departmentId: string
  departmentName: string
  /** From URL `section`, or null to auto-pick Needs review when pending. */
  initialSection?: DepartmentStudentsSection | null
  onSectionChange?: (section: DepartmentStudentsSection) => void
}

const STAGES: {
  id: DepartmentStudentsSection
  label: string
}[] = [
  { id: "review", label: "Needs review" },
  { id: "approved", label: "Approved — not registered" },
  { id: "roster", label: "Roster" },
]

export function DepartmentStudentsPanel({
  departmentId,
  departmentName,
  initialSection = null,
  onSectionChange,
}: DepartmentStudentsPanelProps) {
  const [stage, setStage] = useState<DepartmentStudentsSection>(
    initialSection ?? "roster"
  )
  const [needsReview, setNeedsReview] = useState(0)
  const [approvedPending, setApprovedPending] = useState(0)
  const didAutoPick = useRef(initialSection != null)

  const loadCounts = useCallback(async () => {
    const result = await fetchDepartmentApplicationStageCountsAction(departmentId)
    if (!result.success) return

    setNeedsReview(result.needsReview)
    setApprovedPending(result.approvedPending)

    if (!didAutoPick.current && initialSection == null) {
      didAutoPick.current = true
      setStage(result.needsReview > 0 ? "review" : "roster")
    }
  }, [departmentId, initialSection])

  useEffect(() => {
    void loadCounts()
  }, [loadCounts])

  useEffect(() => {
    if (initialSection) {
      didAutoPick.current = true
      setStage(initialSection)
    }
  }, [initialSection])

  function selectStage(next: DepartmentStudentsSection) {
    didAutoPick.current = true
    setStage(next)
    onSectionChange?.(next)
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Users className="size-4" />
          Participants · {departmentName}
        </h2>
        <p className="text-sm text-muted-foreground">
          Review applications, track approved participants who still need to
          register, and manage the roster.
        </p>
      </div>

      <div className="inline-flex h-auto flex-wrap gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1">
        {STAGES.map((item) => {
          const count =
            item.id === "review"
              ? needsReview
              : item.id === "approved"
                ? approvedPending
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

      {stage === "review" ? (
        <DepartmentApplicationsPanel
          departmentId={departmentId}
          departmentName={departmentName}
          filter="submitted"
          embedded
          onCountsMayHaveChanged={() => void loadCounts()}
        />
      ) : null}

      {stage === "approved" ? (
        <DepartmentApplicationsPanel
          departmentId={departmentId}
          departmentName={departmentName}
          filter="approved_pending_registration"
          embedded
          onCountsMayHaveChanged={() => void loadCounts()}
        />
      ) : null}

      {stage === "roster" ? (
        <DepartmentParticipantsPanel
          departmentId={departmentId}
          departmentName={departmentName}
          embedded
        />
      ) : null}
    </div>
  )
}
