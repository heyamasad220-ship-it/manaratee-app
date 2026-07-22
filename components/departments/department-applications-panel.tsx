"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ClipboardCheck, Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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

/** Department head queue: new-student applications awaiting evaluation. */
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
  const [busyId, setBusyId] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchDepartmentApplicationsAction(departmentId)
    if (!result.success) {
      setError(result.error)
      setApplications([])
    } else {
      setApplications(result.applications)
    }
    setLoading(false)
  }, [departmentId])

  React.useEffect(() => {
    void load()
  }, [load])

  async function handleDecision(
    applicationId: string,
    decision: "approved" | "not_approved"
  ) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) {
      setError("You must be signed in to evaluate applications.")
      return
    }

    setBusyId(applicationId)
    const result = await evaluateProgramApplication({
      applicationId,
      decision,
      evaluatedByUserId: user.id,
    })
    setBusyId(null)
    if (!result.success) {
      setError(result.error)
      return
    }
    await load()
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          Applications · {departmentName}
        </h2>
        <p className="text-sm text-muted-foreground">
          New-student applications waiting for department evaluation. Returning
          students are auto-approved and do not appear here.
        </p>
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
                <TableHead>Student</TableHead>
                <TableHead>Program / Offering</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((application) => (
                <TableRow key={application.id}>
                  <TableCell className="font-medium">
                    {application.participant_name}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {application.program_name || "Program"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {application.offering_name || "Offering"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
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
                        disabled={busyId === application.id}
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
                        disabled={busyId === application.id}
                        onClick={() =>
                          void handleDecision(application.id, "not_approved")
                        }
                      >
                        Not approve
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <ClipboardCheck className="mr-1 inline h-3.5 w-3.5" />
        Approve into a different offering will be added next (select offering on
        evaluate). Waitlist-on-full and register gating come after that.
      </div>
    </div>
  )
}
