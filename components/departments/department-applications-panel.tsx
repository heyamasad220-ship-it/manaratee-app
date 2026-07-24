"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ClipboardCheck, Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  evaluateProgramApplication,
  evaluateProgramApplicationsBatch,
  fetchDepartmentApplicationsAction,
} from "@/lib/programs/program-application-actions"
import type { ProgramApplicationWithDetails } from "@/lib/programs/program-application-types"
import { PROGRAM_APPLICANT_TYPE_LABELS } from "@/lib/programs/program-application-types"
import { createClient } from "@/lib/supabase/client"

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

/** Department head queue: applications awaiting evaluation (new and returning). */
export function DepartmentApplicationsPanel({
  departmentId,
  departmentName,
}: {
  departmentId: string
  departmentName: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [applications, setApplications] = React.useState<
    ProgramApplicationWithDetails[]
  >([])
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [batchBusy, setBatchBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchDepartmentApplicationsAction(departmentId)
    if (!result.success) {
      setError(result.error)
      setApplications([])
      setSelectedIds([])
    } else {
      setApplications(result.applications)
      setSelectedIds((current) =>
        current.filter((id) =>
          result.applications.some((application) => application.id === id)
        )
      )
    }
    setLoading(false)
  }, [departmentId])

  React.useEffect(() => {
    void load()
  }, [load])

  const allSelected =
    applications.length > 0 &&
    applications.every((application) => selectedIds.includes(application.id))
  const hasSelection = selectedIds.length > 0

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? applications.map((application) => application.id) : [])
  }

  function toggleOne(applicationId: string, checked: boolean) {
    setSelectedIds((current) =>
      checked
        ? [...current, applicationId]
        : current.filter((id) => id !== applicationId)
    )
  }

  async function requireUserId() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) {
      setError("You must be signed in to evaluate applications.")
      return null
    }
    return user.id
  }

  async function handleDecision(
    applicationId: string,
    decision: "approved" | "not_approved"
  ) {
    const userId = await requireUserId()
    if (!userId) return

    setBusyId(applicationId)
    const result = await evaluateProgramApplication({
      applicationId,
      decision,
      evaluatedByUserId: userId,
    })
    setBusyId(null)
    if (!result.success) {
      setError(result.error)
      return
    }
    setSelectedIds((current) => current.filter((id) => id !== applicationId))
    await load()
    router.refresh()
  }

  async function handleBatchDecision(decision: "approved" | "not_approved") {
    if (!hasSelection) return
    const userId = await requireUserId()
    if (!userId) return

    setBatchBusy(true)
    setError(null)
    const result = await evaluateProgramApplicationsBatch({
      applicationIds: selectedIds,
      decision,
      evaluatedByUserId: userId,
    })
    setBatchBusy(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    if (result.failed > 0) {
      setError(
        `Updated ${result.approved}, failed ${result.failed}${
          result.errors[0] ? `: ${result.errors[0]}` : "."
        }`
      )
    }

    setSelectedIds([])
    await load()
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Applications · {departmentName}
          </h2>
          <p className="text-sm text-muted-foreground">
            Everyone applies. Review new and returning students, then approve so
            they can register for a program.
          </p>
        </div>
        {applications.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {hasSelection
                ? `${selectedIds.length} selected`
                : "Select students to batch approve"}
            </span>
            <Button
              type="button"
              size="sm"
              disabled={!hasSelection || batchBusy || busyId !== null}
              onClick={() => void handleBatchDecision("approved")}
            >
              {batchBusy ? "Working…" : "Approve selected"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!hasSelection || batchBusy || busyId !== null}
              onClick={() => void handleBatchDecision("not_approved")}
            >
              Not approve selected
            </Button>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading applications…
        </div>
      ) : error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : applications.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          No pending applications.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => toggleAll(checked === true)}
                    aria-label="Select all applications"
                  />
                </TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Year/Season / Program</TableHead>
                <TableHead>New / Returning</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((application) => {
                const selected = selectedIds.includes(application.id)
                const rowBusy = busyId === application.id || batchBusy
                return (
                  <TableRow key={application.id} data-state={selected ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selected}
                        onCheckedChange={(checked) =>
                          toggleOne(application.id, checked === true)
                        }
                        aria-label={`Select ${application.participant_name}`}
                        disabled={rowBusy}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {application.participant_name}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {application.program_name || "Year/Season"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {application.offering_name || "Program"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          application.applicant_type === "new"
                            ? "bg-sky-50 text-sky-800"
                            : undefined
                        }
                      >
                        {
                          PROGRAM_APPLICANT_TYPE_LABELS[
                            application.applicant_type
                          ]
                        }
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(application.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={rowBusy}
                          onClick={() =>
                            void handleDecision(application.id, "approved")
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={rowBusy}
                          onClick={() =>
                            void handleDecision(application.id, "not_approved")
                          }
                        >
                          Not approve
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <ClipboardCheck className="mr-1 inline h-3.5 w-3.5" />
        After approval, students can register for the program. Approve into a
        different program and waitlist-on-full come next.
      </div>
    </div>
  )
}
