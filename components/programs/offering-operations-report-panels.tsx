"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type WaitlistRow = {
  id: string
  child_name: string
  parent_name: string | null
  status: string
  position: number | null
  added_date: string | null
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
  if (!value) return "-"
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

function getStatusBadge(status: string) {
  switch (status) {
    case "converted":
    case "offered":
      return (
        <Badge className="bg-violet-500/10 text-violet-600 hover:bg-violet-500/20">{status}</Badge>
      )
    case "waiting":
      return (
        <Badge className="bg-sky-500/10 text-sky-600 hover:bg-sky-500/20">{status}</Badge>
      )
    case "expired":
      return <Badge className="bg-zinc-500/10 text-zinc-600 hover:bg-zinc-500/20">{status}</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
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

/** Temporary offering-level panels moved from Programs → Reports (to clean up later). */
export function OfferingWaitlistPanel({
  programId,
  offeringName,
}: {
  programId: string
  offeringId: string
  offeringName: string
}) {
  const supabase = createClient()
  const [loading, setLoading] = React.useState(true)
  const [items, setItems] = React.useState<WaitlistRow[]>([])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from("program_waitlist")
        .select("id, child_name, parent_name, status, position, added_date")
        .eq("program_id", programId)
        .order("position")
      if (!cancelled) {
        if (error) {
          console.warn("program_waitlist could not be loaded:", error.message)
          setItems([])
        } else {
          setItems((data || []) as WaitlistRow[])
        }
        setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [programId, supabase])

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">Waitlist</h3>
        <p className="text-sm text-muted-foreground">
          Waitlist for {offeringName} (program-level queue for now).
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard label="Total" value={items.length} />
        <MetricCard
          label="Waiting"
          value={items.filter((item) => item.status === "waiting").length}
          valueClassName="text-sky-500"
        />
        <MetricCard
          label="Offered"
          value={items.filter((item) => item.status === "offered").length}
          valueClassName="text-violet-500"
        />
        <MetricCard
          label="Expired"
          value={items.filter((item) => item.status === "expired").length}
          valueClassName="text-zinc-500"
        />
      </div>
      <SimpleTable
        loading={loading}
        empty="No waitlist entries for this program yet."
        headers={["Participant", "Parent", "Position", "Added", "Status"]}
        rows={items.map((item) => [
          item.child_name,
          item.parent_name || "-",
          item.position == null ? "-" : String(item.position),
          formatDate(item.added_date),
          getStatusBadge(item.status),
        ])}
      />
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
        <h3 className="text-base font-semibold">Before &amp; After Care</h3>
        <p className="text-sm text-muted-foreground">
          Care check-in records for {offeringName}.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Care Records" value={items.length} />
        <MetricCard
          label="Before Care"
          value={items.filter((item) => item.before_check_in).length}
        />
        <MetricCard
          label="After Care"
          value={items.filter((item) => item.after_check_out).length}
        />
      </div>
      <SimpleTable
        loading={loading}
        empty="No before or after care records found."
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
