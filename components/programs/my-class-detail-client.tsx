"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { upsertOfferingAttendanceMarks } from "@/lib/programs/program-attendance-actions"
import {
  PROGRAM_ATTENDANCE_STATUS_OPTIONS,
  type ProgramAttendanceRecord,
  type ProgramAttendanceStatus,
} from "@/lib/programs/program-attendance-types"
import type { OfferingRosterEnrollment } from "@/lib/programs/program-staff-assignment-queries"
import {
  PROGRAM_STAFF_ASSIGNMENT_ROLE_LABELS,
  type ProgramStaffAssignmentWithDetails,
} from "@/lib/programs/program-staff-assignment-types"
import { cn } from "@/lib/utils"

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatStatus(value: string | null) {
  if (!value) return "—"
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

function todayDateString() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function MyClassDetailClient({
  userId,
  organizationId,
  offeringId,
  programName,
  offeringName,
  attendanceTracked,
  roster,
  staffAssignments,
  myAssignments,
  initialAttendanceDate,
  initialAttendance,
}: {
  userId: string
  organizationId: string
  offeringId: string
  programName: string
  offeringName: string
  attendanceTracked: boolean
  roster: OfferingRosterEnrollment[]
  staffAssignments: ProgramStaffAssignmentWithDetails[]
  myAssignments: ProgramStaffAssignmentWithDetails[]
  initialAttendanceDate: string
  initialAttendance: ProgramAttendanceRecord[]
}) {
  const router = useRouter()
  const [attendanceDate, setAttendanceDate] = React.useState(
    initialAttendanceDate || todayDateString()
  )
  const [marks, setMarks] = React.useState<
    Record<string, ProgramAttendanceStatus>
  >(() => {
    const next: Record<string, ProgramAttendanceStatus> = {}
    for (const row of initialAttendance) {
      next[row.enrollment_id] = row.status
    }
    return next
  })
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)

  React.useEffect(() => {
    const next: Record<string, ProgramAttendanceStatus> = {}
    for (const row of initialAttendance) {
      next[row.enrollment_id] = row.status
    }
    setMarks(next)
    setAttendanceDate(initialAttendanceDate || todayDateString())
    setError(null)
    setSuccess(false)
  }, [initialAttendance, initialAttendanceDate])

  async function handleDateChange(value: string) {
    setAttendanceDate(value)
    setSuccess(false)
    setError(null)
    router.replace(`/my-classes/${offeringId}?date=${value}`)
    router.refresh()
  }

  async function handleSaveAttendance() {
    setIsSaving(true)
    setError(null)
    setSuccess(false)

    const payload = roster.map((enrollment) => ({
      enrollmentId: enrollment.id,
      status: marks[enrollment.id] ?? ("present" as ProgramAttendanceStatus),
    }))

    const result = await upsertOfferingAttendanceMarks({
      userId,
      organizationId,
      offeringId,
      attendanceDate,
      marks: payload,
    })

    setIsSaving(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    setSuccess(true)
    router.refresh()
  }

  function markAll(status: ProgramAttendanceStatus) {
    const next: Record<string, ProgramAttendanceStatus> = {}
    for (const enrollment of roster) {
      next[enrollment.id] = status
    }
    setMarks(next)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/my-classes">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to My Classes
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {programName} · {offeringName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Class roster
          {attendanceTracked ? " and attendance" : ""} for your assigned
          program.
        </p>
        {myAssignments.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {myAssignments.map((assignment) => (
              <Badge key={assignment.id} variant="secondary">
                {PROGRAM_STAFF_ASSIGNMENT_ROLE_LABELS[
                  assignment.assignment_role
                ] ?? assignment.assignment_role}
                {assignment.session_name ? ` · ${assignment.session_name}` : ""}
              </Badge>
            ))}
          </div>
        ) : staffAssignments.length > 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Viewing as organization admin.
          </p>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Roster</CardTitle>
          <CardDescription>
            {roster.length} participant{roster.length === 1 ? "" : "s"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {roster.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No active enrollments for this program yet.
            </p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Participant</TableHead>
                    <TableHead>Parent / Guardian</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Enrolled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roster.map((enrollment) => (
                    <TableRow key={enrollment.id}>
                      <TableCell>
                        <div className="font-medium">{enrollment.child_name}</div>
                        {enrollment.child_age != null ? (
                          <div className="text-xs text-muted-foreground">
                            Age {enrollment.child_age}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {enrollment.parent_name || "—"}
                        </div>
                        {enrollment.parent_email ? (
                          <div className="text-xs text-muted-foreground">
                            {enrollment.parent_email}
                          </div>
                        ) : null}
                        {enrollment.parent_phone ? (
                          <div className="text-xs text-muted-foreground">
                            {enrollment.parent_phone}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>{formatStatus(enrollment.status)}</TableCell>
                      <TableCell>
                        {formatDate(enrollment.enrollment_date)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {attendanceTracked ? (
        <Card>
          <CardHeader>
            <CardTitle>Attendance</CardTitle>
            <CardDescription>
              Mark who was present for the selected date. Unmarked students
              default to Present when you save.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="attendance-date">Date</Label>
                <Input
                  id="attendance-date"
                  type="date"
                  className="h-9 w-44"
                  value={attendanceDate}
                  onChange={(event) =>
                    void handleDateChange(event.target.value)
                  }
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => markAll("present")}
              >
                Mark all present
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => markAll("absent")}
              >
                Mark all absent
              </Button>
            </div>

            {roster.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No participants to mark.
              </p>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Participant</TableHead>
                      <TableHead>Attendance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roster.map((enrollment) => {
                      const status = marks[enrollment.id] ?? "present"
                      return (
                        <TableRow key={enrollment.id}>
                          <TableCell className="font-medium">
                            {enrollment.child_name}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1.5">
                              {PROGRAM_ATTENDANCE_STATUS_OPTIONS.map(
                                (option) => (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() =>
                                      setMarks((current) => ({
                                        ...current,
                                        [enrollment.id]: option.value,
                                      }))
                                    }
                                    className={cn(
                                      "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                                      status === option.value
                                        ? option.value === "present"
                                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                          : option.value === "absent"
                                            ? "border-red-300 bg-red-50 text-red-800"
                                            : "border-amber-300 bg-amber-50 text-amber-900"
                                        : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                                    )}
                                  >
                                    {option.label}
                                  </button>
                                )
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
            {success ? (
              <p className="text-sm text-emerald-700">Attendance saved.</p>
            ) : null}

            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => void handleSaveAttendance()}
                disabled={isSaving || roster.length === 0}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save attendance"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Attendance tracking is not enabled for this program. An
            administrator can turn it on under the program Overview → Feature
            packs.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
