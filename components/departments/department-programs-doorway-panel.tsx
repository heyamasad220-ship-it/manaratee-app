"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  fetchDepartmentYearProgramsAction,
  type DepartmentYearProgramsBundle,
} from "@/lib/departments/department-year-actions"
import { programCountPhrase } from "@/lib/programs/program-display-labels"
import { getProgramStatusLabel, type ProgramStatus } from "@/lib/programs/program-status"
import { programWorkspaceHref } from "@/lib/programs/program-workspace-path"

function enrollmentPhrase(count: number) {
  return `${count} ${count === 1 ? "enrollment" : "enrollments"}`
}

/** Department Programs tab — summary doorway into the Programs module. */
export function DepartmentProgramsDoorwayPanel({
  departmentId,
}: {
  departmentId: string
  departmentName?: string
}) {
  const [bundle, setBundle] = useState<DepartmentYearProgramsBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchDepartmentYearProgramsAction(departmentId)
    if (!result.success) {
      setError(result.error)
      setBundle(null)
    } else {
      setBundle(result.data)
    }
    setLoading(false)
  }, [departmentId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading programs…
      </div>
    )
  }

  if (error || !bundle) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Programs</CardTitle>
          <CardDescription>{error || "Could not load programs."}</CardDescription>
        </CardHeader>
        <div className="px-6 pb-6">
          <Button variant="outline" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      </Card>
    )
  }

  const programs = bundle.openPrograms

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Programs</h2>
        <p className="text-sm text-muted-foreground">
          Programs for this department. Open one to manage it in Programs.
        </p>
      </div>

      {programs.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No programs</CardTitle>
            <CardDescription>
              Add a year or season in the Programs module.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="divide-y rounded-lg border">
          {programs.map((program) => (
            <Link
              key={program.id}
              href={programWorkspaceHref(program.id)}
              className="block px-4 py-3 text-sm transition-colors hover:bg-muted/40"
            >
              <span className="font-medium text-sky-800">{program.name}</span>
              <span className="text-muted-foreground">
                {" "}
                — {getProgramStatusLabel((program.status as ProgramStatus) || "active")}{" "}
                — {programCountPhrase(program.offeringCount)} —{" "}
                {enrollmentPhrase(program.enrolled)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
