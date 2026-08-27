"use client"

import * as React from "react"
import Link from "next/link"
import {
  Eye,
  Loader2,
  MoreHorizontal,
  UserPlus,
  UserX,
} from "lucide-react"

import {
  promoteWaitlistAction,
  removeWaitlistEntryAction,
} from "@/app/(dashboard)/programs/registrations/actions"
import { Badge } from "@/components/ui/badge"
import { PhoneText } from "@/components/ui/phone-text"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { createClient } from "@/lib/supabase/client"
import { canPromoteWaitlist } from "@/lib/programs/program-lifecycle-types"
import { cn } from "@/lib/utils"

type WaitlistRow = {
  id: string
  child_name: string
  child_age: number | null
  parent_name: string | null
  parent_email: string | null
  parent_phone: string | null
  status: string
  position: number | null
  added_date: string | null
  offer_expiry: string | null
  offering_id?: string | null
}

type CareRow = {
  id: string
  care_date: string | null
  before_check_in: string | null
  after_check_out: string | null
  enrollment?: { child_name?: string | null; offering_id?: string | null } | null
}

type EnrollmentRow = {
  id: string
  child_name: string
  offering_id?: string | null
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function getPercent(part: number, whole: number) {
  if (!whole) return 0
  return Math.round((part / whole) * 100)
}

function formatStatusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

function getStatusBadge(status: string) {
  switch (status) {
    case "converted":
    case "offered":
    case "accepted":
      return (
        <Badge className="bg-violet-500/10 text-violet-600 hover:bg-violet-500/20">
          {formatStatusLabel(status)}
        </Badge>
      )
    case "waiting":
      return (
        <Badge className="bg-sky-500/10 text-sky-600 hover:bg-sky-500/20">
          {formatStatusLabel(status)}
        </Badge>
      )
    case "expired":
    case "removed":
    case "declined":
      return (
        <Badge className="bg-zinc-500/10 text-zinc-600 hover:bg-zinc-500/20">
          {formatStatusLabel(status)}
        </Badge>
      )
    default:
      return <Badge variant="secondary">{formatStatusLabel(status)}</Badge>
  }
}

function MetricCard({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: React.ReactNode
  valueClassName?: string
}) {
  return (
    <Card className="min-w-0">
      <CardHeader className="space-y-2 p-5">
        <CardDescription className="text-sm">{label}</CardDescription>
        <CardTitle className={cn("text-3xl font-bold tracking-tight", valueClassName)}>
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  )
}

function SimpleTable({
  loading,
  empty,
  headers,
  rows,
}: {
  loading: boolean
  empty: string
  headers: string[]
  rows: React.ReactNode[][]
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((header) => (
                <TableHead key={header}>{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={headers.length} className="py-10 text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={headers.length} className="py-10 text-center text-muted-foreground">
                  {empty}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => (
                <TableRow key={index}>
                  {row.map((cell, cellIndex) => (
                    <TableCell key={cellIndex}>{cell}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

/** Waitlist view — filter by offering when `offeringId` is set; omit for all offerings in scope. */
export function OfferingWaitlistPanel({
  programId,
  offeringId,
  offeringName,
  offeringIds,
  programIds,
}: {
  programId?: string
  offeringId?: string
  offeringName: string
  /** Reports → All programs: waitlist rows for these offerings (and program-level null offering_id). */
  offeringIds?: string[]
  programIds?: string[]
}) {
  const supabase = createClient()
  const [loading, setLoading] = React.useState(true)
  const [items, setItems] = React.useState<WaitlistRow[]>([])
  const [programMeta, setProgramMeta] = React.useState<{
    capacity: number
    enrolled: number
  } | null>(null)

  const reportsHref = "/programs/reports?tab=waitlist"
  const scopeProgramIds = React.useMemo(() => {
    if (programIds && programIds.length > 0) return programIds
    if (programId) return [programId]
    return []
  }, [programId, programIds])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)

      if (scopeProgramIds.length === 0) {
        setItems([])
        setProgramMeta(null)
        setLoading(false)
        return
      }

      let waitlistQuery = supabase
        .from("program_waitlist")
        .select(
          "id, child_name, child_age, parent_name, parent_email, parent_phone, status, position, added_date, offer_expiry, offering_id"
        )
        .in("program_id", scopeProgramIds)
        .order("position", { ascending: true, nullsFirst: false })

      if (offeringId) {
        waitlistQuery = waitlistQuery.or(
          `offering_id.eq.${offeringId},offering_id.is.null`
        )
      }

      const [waitlistResult, programResult] = await Promise.all([
        waitlistQuery,
        programId
          ? supabase
              .from("programs")
              .select("capacity, enrolled")
              .eq("id", programId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ])

      if (cancelled) return

      if (waitlistResult.error) {
        console.warn(
          "program_waitlist could not be loaded:",
          waitlistResult.error.message
        )
        setItems([])
      } else {
        const rows = (waitlistResult.data || []) as WaitlistRow[]
        const offeringIdSet =
          !offeringId && offeringIds && offeringIds.length > 0
            ? new Set(offeringIds)
            : null
        setItems(
          rows.filter((row) => {
            if (offeringId) {
              return (
                row.offering_id === offeringId || row.offering_id == null
              )
            }
            if (offeringIdSet) {
              return (
                row.offering_id == null ||
                offeringIdSet.has(row.offering_id)
              )
            }
            return true
          })
        )
      }

      if (!programResult.error && programResult.data) {
        setProgramMeta({
          capacity: Number(programResult.data.capacity) || 0,
          enrolled: Number(programResult.data.enrolled) || 0,
        })
      } else {
        setProgramMeta(null)
      }

      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [programId, offeringId, offeringIds, scopeProgramIds, supabase])

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Participant</TableHead>
            <TableHead>Parent / Contact</TableHead>
            <TableHead className="w-24">Position</TableHead>
            <TableHead>Added</TableHead>
            <TableHead>Offer expires</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-12 text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="py-10 text-center text-muted-foreground"
              >
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading waitlist…
                </span>
              </TableCell>
            </TableRow>
          ) : items.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="py-10 text-center text-muted-foreground"
              >
                No waitlist entries for {offeringName} yet.
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => {
              const canPromote = programMeta
                ? canPromoteWaitlist(item.status, programMeta)
                : ["waiting", "offered"].includes(item.status)

              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium">{item.child_name}</div>
                    {item.child_age != null ? (
                      <div className="text-xs text-muted-foreground">
                        Age {item.child_age}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{item.parent_name || "—"}</div>
                    {item.parent_email ? (
                      <div className="text-xs text-muted-foreground">
                        {item.parent_email}
                      </div>
                    ) : null}
                    {item.parent_phone ? (
                      <div className="text-xs text-muted-foreground">
                        <PhoneText value={item.parent_phone} empty="" />
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {item.position == null ? "—" : `#${item.position}`}
                  </TableCell>
                  <TableCell>{formatDate(item.added_date)}</TableCell>
                  <TableCell>{formatDate(item.offer_expiry)}</TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Actions for ${item.child_name}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/programs/registrations/waitlist/${item.id}`}
                            className="flex items-center gap-2"
                          >
                            <Eye className="h-4 w-4" />
                            View details
                          </Link>
                        </DropdownMenuItem>
                        {canPromote ? (
                          <form action={promoteWaitlistAction}>
                            <input
                              type="hidden"
                              name="waitlist_id"
                              value={item.id}
                            />
                            <input
                              type="hidden"
                              name="redirect_to"
                              value={reportsHref}
                            />
                            <DropdownMenuItem asChild>
                              <button
                                type="submit"
                                className="flex w-full cursor-default items-center gap-2"
                              >
                                <UserPlus className="h-4 w-4" />
                                Promote to registration
                              </button>
                            </DropdownMenuItem>
                          </form>
                        ) : null}
                        <DropdownMenuSeparator />
                        {item.status !== "removed" ? (
                          <form action={removeWaitlistEntryAction}>
                            <input
                              type="hidden"
                              name="waitlist_id"
                              value={item.id}
                            />
                            <input
                              type="hidden"
                              name="redirect_to"
                              value={reportsHref}
                            />
                            <DropdownMenuItem asChild>
                              <button
                                type="submit"
                                className="flex w-full cursor-default items-center gap-2 text-destructive"
                                onClick={(event) => {
                                  if (
                                    !window.confirm(
                                      `Remove ${item.child_name} from the waitlist?`
                                    )
                                  ) {
                                    event.preventDefault()
                                  }
                                }}
                              >
                                <UserX className="h-4 w-4" />
                                Remove from waitlist
                              </button>
                            </DropdownMenuItem>
                          </form>
                        ) : null}
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/programs/${programId}`}
                            className="flex items-center gap-2"
                          >
                            View program
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export function OfferingBeforeAfterCarePanel({
  programId,
  offeringId,
  offeringName,
}: {
  programId: string
  offeringId: string
  offeringName: string
}) {
  const supabase = createClient()
  const [loading, setLoading] = React.useState(true)
  const [items, setItems] = React.useState<CareRow[]>([])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from("program_extended_care")
        .select(`
          id,
          care_date,
          before_check_in,
          after_check_out,
          enrollment:enrollment_id (
            child_name,
            offering_id,
            program_id
          )
        `)
        .order("care_date", { ascending: false })
      if (!cancelled) {
        if (error) {
          console.warn("program_extended_care could not be loaded:", error.message)
          setItems([])
        } else {
          const rows = ((data || []) as CareRow[]).filter((row) => {
            const enrollment = row.enrollment as
              | { offering_id?: string | null; program_id?: string | null }
              | null
              | undefined
            if (!enrollment) return false
            if (enrollment.offering_id) return enrollment.offering_id === offeringId
            return enrollment.program_id === programId
          })
          setItems(rows)
        }
        setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [offeringId, programId, supabase])

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">Childcare</h3>
        <p className="text-sm text-muted-foreground">
          Childcare check-in records for {offeringName}.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Records" value={items.length} />
        <MetricCard
          label="Before care"
          value={items.filter((item) => item.before_check_in).length}
        />
        <MetricCard
          label="After care"
          value={items.filter((item) => item.after_check_out).length}
        />
      </div>
      <SimpleTable
        loading={loading}
        empty="No childcare records found."
        headers={["Participant", "Date", "Before Check-In", "After Check-Out"]}
        rows={items.map((item) => [
          item.enrollment?.child_name || "-",
          formatDate(item.care_date),
          item.before_check_in ? new Date(item.before_check_in).toLocaleTimeString() : "-",
          item.after_check_out ? new Date(item.after_check_out).toLocaleTimeString() : "-",
        ])}
      />
    </div>
  )
}

export function OfferingAttendancePanel({
  programId,
  offeringId,
  offeringName,
}: {
  programId: string
  offeringId: string
  offeringName: string
}) {
  const supabase = createClient()
  const [loading, setLoading] = React.useState(true)
  const [enrollments, setEnrollments] = React.useState<EnrollmentRow[]>([])
  const [careItems, setCareItems] = React.useState<CareRow[]>([])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [enrollmentsResult, careResult] = await Promise.all([
        supabase
          .from("program_enrollments")
          .select("id, child_name, offering_id, program_id")
          .eq("program_id", programId),
        supabase
          .from("program_extended_care")
          .select(`
            id,
            care_date,
            before_check_in,
            after_check_out,
            enrollment:enrollment_id (
              child_name,
              offering_id,
              program_id
            )
          `)
          .order("care_date", { ascending: false }),
      ])

      if (!cancelled) {
        if (enrollmentsResult.error) {
          console.warn("program_enrollments could not be loaded:", enrollmentsResult.error.message)
          setEnrollments([])
        } else {
          const rows = ((enrollmentsResult.data || []) as EnrollmentRow[]).filter((row) =>
            row.offering_id ? row.offering_id === offeringId : true
          )
          setEnrollments(rows)
        }

        if (careResult.error) {
          console.warn("program_extended_care could not be loaded:", careResult.error.message)
          setCareItems([])
        } else {
          const rows = ((careResult.data || []) as CareRow[]).filter((row) => {
            const enrollment = row.enrollment as
              | { offering_id?: string | null; program_id?: string | null }
              | null
              | undefined
            if (!enrollment) return false
            if (enrollment.offering_id) return enrollment.offering_id === offeringId
            return enrollment.program_id === programId
          })
          setCareItems(rows)
        }
        setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [offeringId, programId, supabase])

  const attended = careItems.filter(
    (item) => item.before_check_in || item.after_check_out
  ).length
  const attendanceRate = getPercent(attended, Math.max(careItems.length, 1))

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">Attendance</h3>
        <p className="text-sm text-muted-foreground">
          Attendance snapshot for {offeringName}.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Overall Attendance" value={`${attendanceRate}%`} />
        <MetricCard label="Attendance Records" value={careItems.length} />
        <MetricCard label="Enrollments" value={enrollments.length} />
      </div>
      <SimpleTable
        loading={loading}
        empty="No attendance data found."
        headers={["Participant", "Care Records", "Checked In"]}
        rows={enrollments.map((enrollment) => {
          const records = careItems.filter(
            (item) =>
              (item.enrollment as { child_name?: string | null } | null | undefined)
                ?.child_name === enrollment.child_name
          )
          const checkedIn = records.filter(
            (item) => item.before_check_in || item.after_check_out
          ).length
          return [
            enrollment.child_name,
            String(records.length),
            checkedIn > 0 ? `${checkedIn}` : "-",
          ]
        })}
      />
    </div>
  )
}

type ClassAttendanceRow = {
  id: string
  attendance_date: string
  status: string
  enrollment?: { child_name?: string | null } | null
}

/** F5/F7: Class attendance marks from program_attendance (teacher My Classes). */
export function OfferingClassAttendancePanel({
  offeringId,
  offeringName,
}: {
  offeringId: string
  offeringName: string
}) {
  const supabase = createClient()
  const [loading, setLoading] = React.useState(true)
  const [items, setItems] = React.useState<ClassAttendanceRow[]>([])
  const [selectedDate, setSelectedDate] = React.useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  })

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from("program_attendance")
        .select(
          `
          id,
          attendance_date,
          status,
          enrollment:enrollment_id ( child_name )
        `
        )
        .eq("offering_id", offeringId)
        .eq("attendance_date", selectedDate)
        .order("created_at", { ascending: true })

      if (!cancelled) {
        if (error) {
          console.warn("program_attendance could not be loaded:", error.message)
          setItems([])
        } else {
          setItems((data || []) as ClassAttendanceRow[])
        }
        setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [offeringId, selectedDate, supabase])

  const present = items.filter((row) => row.status === "present").length
  const absent = items.filter((row) => row.status === "absent").length
  const other = items.length - present - absent

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Class attendance</h3>
          <p className="text-sm text-muted-foreground">
            Marks teachers saved for {offeringName} (My Classes).
          </p>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="class-att-date">
            Date
          </label>
          <input
            id="class-att-date"
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Present" value={present} />
        <MetricCard label="Absent" value={absent} />
        <MetricCard label="Late / Excused" value={other} />
      </div>
      <SimpleTable
        loading={loading}
        empty="No class attendance saved for this date yet."
        headers={["Participant", "Status"]}
        rows={items.map((item) => [
          item.enrollment?.child_name || "-",
          item.status.replace(/_/g, " "),
        ])}
      />
    </div>
  )
}
