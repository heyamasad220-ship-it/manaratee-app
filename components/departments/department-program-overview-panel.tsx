"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { ProgramBasicsSection } from "@/components/programs/edit/program-basics-section"
import type { VisibilityType } from "@/components/programs/edit/types"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchDepartmentYearBasicsAction } from "@/lib/departments/department-year-actions"
import type { Department } from "@/lib/departments/department-types"
import { updateProgramBasics } from "@/lib/programs/program-detail-actions"
import { YEAR_SEASON_LABEL } from "@/lib/programs/program-display-labels"
import type { Program } from "@/lib/programs/program-types"

function toVisibility(value: string | null | undefined): VisibilityType {
  if (value === "members_only" || value === "private") return value
  return "public"
}

/** Year/program workspace Settings (`?tab=settings`). */
export function DepartmentProgramOverviewPanel({
  departmentId,
  yearProgramId,
  hideChrome = false,
  onProgramMetaChanged,
}: {
  departmentId: string
  yearProgramId: string
  hideChrome?: boolean
  onProgramMetaChanged?: () => void
}) {
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [program, setProgram] = React.useState<Program | null>(null)
  const [departments, setDepartments] = React.useState<Department[]>([])
  const [visibility, setVisibility] = React.useState<string | null>(null)
  const [programStatus, setProgramStatus] = React.useState("draft")
  const [canEdit, setCanEdit] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchDepartmentYearBasicsAction(
      departmentId,
      yearProgramId
    )
    if (!result.success) {
      setError(result.error)
      setProgram(null)
      setLoading(false)
      return
    }
    setProgram(result.data.program)
    setDepartments(result.data.departments)
    setVisibility(result.data.visibility)
    setProgramStatus(result.data.program.status)
    // Same gate as Configure dialog: department manage / year manage via basics load success;
    // editability follows staff manage on save (server enforces).
    setCanEdit(true)
    setLoading(false)
  }, [departmentId, yearProgramId])

  React.useEffect(() => {
    void load()
  }, [load])

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

    await load()
    onProgramMetaChanged?.()
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading {YEAR_SEASON_LABEL.toLowerCase()}…
      </div>
    )
  }

  if (!program) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>
            {error || `Could not load this ${YEAR_SEASON_LABEL.toLowerCase()}.`}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {hideChrome ? null : (
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
          <p className="text-sm text-muted-foreground">
            Name, dates, eligibility, flyer, and publishing for this{" "}
            {YEAR_SEASON_LABEL.toLowerCase()}.
          </p>
        </div>
      )}

      <form onSubmit={(event) => void handleSave(event)} className="space-y-4">
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

        {canEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        ) : null}
      </form>
    </div>
  )
}
