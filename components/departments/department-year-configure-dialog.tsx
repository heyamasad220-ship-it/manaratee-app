"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { ProgramBasicsSection } from "@/components/programs/edit/program-basics-section"
import type { VisibilityType } from "@/components/programs/edit/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { fetchDepartmentYearBasicsAction } from "@/lib/departments/department-year-actions"
import type { Department } from "@/lib/departments/department-types"
import { updateProgramBasics } from "@/lib/programs/program-detail-actions"
import { getHierarchyLabels } from "@/lib/programs/program-display-labels"
import { normalizeProgramKind } from "@/lib/programs/program-kind"
import type { Program } from "@/lib/programs/program-types"

function toVisibility(value: string | null | undefined): VisibilityType {
  if (value === "members_only" || value === "private") return value
  return "public"
}

export function DepartmentYearConfigureDialog({
  departmentId,
  programId,
  programName,
  open,
  onOpenChange,
  onSaved,
}: {
  departmentId: string
  programId: string | null
  programName?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void | Promise<void>
}) {
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [program, setProgram] = React.useState<Program | null>(null)
  const [departments, setDepartments] = React.useState<Department[]>([])
  const [visibility, setVisibility] = React.useState<string | null>(null)
  const [programStatus, setProgramStatus] = React.useState("draft")
  const formRef = React.useRef<HTMLFormElement>(null)
  const containerLabel = getHierarchyLabels(
    normalizeProgramKind(program?.program_kind)
  ).containerSingular

  React.useEffect(() => {
    if (!open || !programId) return

    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      setProgram(null)

      const result = await fetchDepartmentYearBasicsAction(
        departmentId,
        programId as string
      )
      if (cancelled) return

      if (!result.success) {
        setError(result.error)
        setLoading(false)
        return
      }

      setProgram(result.data.program)
      setDepartments(result.data.departments)
      setVisibility(result.data.visibility)
      setProgramStatus(result.data.program.status)
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [open, programId, departmentId])

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!program) return

    const formData = new FormData(event.currentTarget)
    const name = String(formData.get("name") || "").trim()
    if (!name) {
      setError(`${YEAR_SEASON_LABEL} name is required.`)
      return
    }

    setSaving(true)
    setError(null)

    const result = await updateProgramBasics({
      programId: program.id,
      name,
      subtitle: String(formData.get("subtitle") || "").trim() || null,
      description: String(formData.get("description") || "").trim() || null,
      department_id: String(formData.get("department_id") || "").trim() || null,
      flyer_url: String(formData.get("flyer_url") || "").trim() || null,
      background_color:
        String(formData.get("background_color") || "").trim() || null,
      visibility: toVisibility(String(formData.get("visibility") || "public")),
      status: programStatus,
      start_date: String(formData.get("start_date") || "").trim() || null,
      end_date: String(formData.get("end_date") || "").trim() || null,
      enrollment_open_date:
        String(formData.get("enrollment_open_date") || "").trim() || null,
      enrollment_close_date:
        String(formData.get("enrollment_close_date") || "").trim() || null,
      gender: String(formData.get("gender") || "All").trim() || "All",
      min_age: (() => {
        const raw = String(formData.get("min_age") || "").trim()
        if (!raw) return null
        const n = Number(raw)
        return Number.isFinite(n) ? n : null
      })(),
      max_age: (() => {
        const raw = String(formData.get("max_age") || "").trim()
        if (!raw) return null
        const n = Number(raw)
        return Number.isFinite(n) ? n : null
      })(),
      syncOfferingDates: true,
    })

    setSaving(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    onOpenChange(false)
    await onSaved?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>Configure {containerLabel}</DialogTitle>
          <DialogDescription>
            {programName || program?.name || "Edit name, dates, eligibility, flyer, and publishing."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading {containerLabel.toLowerCase()}…
            </div>
          ) : program ? (
            <form
              ref={formRef}
              id="department-year-configure-form"
              onSubmit={(event) => void handleSave(event)}
              className="w-full space-y-4"
            >
              {error ? (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              ) : null}
              <ProgramBasicsSection
                key={program.id + String(program.updated_at)}
                program={program}
                programId={program.id}
                departments={departments}
                status={programStatus}
                onStatusChange={setProgramStatus}
                initialVisibility={toVisibility(visibility)}
                programStatusFallback={program.status}
                layout="stack"
                hideDepartment
              />
            </form>
          ) : (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error || `Could not load this ${containerLabel.toLowerCase()}.`}
            </p>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="department-year-configure-form"
            disabled={saving || loading || !program}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
