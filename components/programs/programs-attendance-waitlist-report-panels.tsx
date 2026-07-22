"use client"

import * as React from "react"
import { ClipboardCheck, ListOrdered, Loader2 } from "lucide-react"

import {
  OfferingBeforeAfterCarePanel,
  OfferingClassAttendancePanel,
  OfferingWaitlistPanel,
} from "@/components/programs/offering-operations-report-panels"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

export type ReportOfferingOption = {
  id: string
  name: string
  programId: string
  programName: string
  attendanceTracked: boolean
  careEnabled: boolean
  waitlistEnabled: boolean
}

async function loadReportOfferings(): Promise<ReportOfferingOption[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("program_offerings")
    .select(
      `
      id,
      name,
      program_id,
      attendance_tracked,
      care_enabled,
      enable_waitlist,
      status,
      program:program_id ( name )
    `
    )
    .neq("status", "archived")
    .order("name", { ascending: true })

  if (error) {
    console.warn("Could not load offerings for reports:", error.message)
    return []
  }

  return (data || []).map((row) => {
    const program = row.program as { name?: string } | null
    return {
      id: row.id as string,
      name: (row.name as string) || "Offering",
      programId: row.program_id as string,
      programName: program?.name || "Program",
      attendanceTracked: Boolean(row.attendance_tracked),
      careEnabled: Boolean(row.care_enabled),
      waitlistEnabled: Boolean(row.enable_waitlist),
    }
  })
}

function OfferingFilterSelect({
  offerings,
  value,
  onChange,
  loading,
}: {
  offerings: ReportOfferingOption[]
  value: string
  onChange: (offeringId: string) => void
  loading: boolean
}) {
  return (
    <div className="space-y-1.5 sm:max-w-md">
      <Label htmlFor="report-offering-filter">Offering</Label>
      <select
        id="report-offering-filter"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={loading || offerings.length === 0}
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
      >
        {offerings.length === 0 ? (
          <option value="">No offerings</option>
        ) : (
          offerings.map((offering) => (
            <option key={offering.id} value={offering.id}>
              {offering.programName} · {offering.name}
            </option>
          ))
        )}
      </select>
    </div>
  )
}

function useReportOfferings() {
  const [loading, setLoading] = React.useState(true)
  const [offerings, setOfferings] = React.useState<ReportOfferingOption[]>([])
  const [selectedId, setSelectedId] = React.useState("")

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const rows = await loadReportOfferings()
      if (cancelled) return
      setOfferings(rows)
      setSelectedId((current) => {
        if (current && rows.some((row) => row.id === current)) return current
        return rows[0]?.id || ""
      })
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const selected = offerings.find((row) => row.id === selectedId) || null

  return {
    loading,
    offerings,
    selected,
    selectedId,
    setSelectedId,
  }
}

/** Programs → Reports → Attendance (filter by offering). */
export function ProgramsAttendanceReportPanel() {
  const { loading, offerings, selected, selectedId, setSelectedId } =
    useReportOfferings()

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading offerings…
      </div>
    )
  }

  if (!selected) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No offerings available. Create an offering first, then enable
          attendance under Overview → Feature packs.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <ClipboardCheck className="h-5 w-5" />
            Attendance
          </h2>
          <p className="text-sm text-muted-foreground">
            Review class attendance by offering. Enable tracking on the offering
            Overview → Feature packs.
          </p>
        </div>
        <OfferingFilterSelect
          offerings={offerings}
          value={selectedId}
          onChange={setSelectedId}
          loading={loading}
        />
      </div>

      {selected.attendanceTracked ? (
        <OfferingClassAttendancePanel
          offeringId={selected.id}
          offeringName={selected.name}
        />
      ) : (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Attendance tracking is off for{" "}
          <span className="font-medium text-foreground">{selected.name}</span>.
          Enable it on the offering Overview → Feature packs so teachers can
          mark attendance in My Classes.
        </div>
      )}

      {selected.careEnabled ? (
        <OfferingBeforeAfterCarePanel
          programId={selected.programId}
          offeringId={selected.id}
          offeringName={selected.name}
        />
      ) : null}
    </div>
  )
}

/** Programs → Reports → Waitlist (filter by offering). */
export function ProgramsWaitlistReportPanel() {
  const { loading, offerings, selected, selectedId, setSelectedId } =
    useReportOfferings()

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading offerings…
      </div>
    )
  }

  if (!selected) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No offerings available. Create an offering and turn on waitlist under
          Enrollment when capacity is limited.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <ListOrdered className="h-5 w-5" />
            Waitlist
          </h2>
          <p className="text-sm text-muted-foreground">
            View waitlist entries by offering. Turn waitlist on or off under the
            offering Enrollment settings.
          </p>
        </div>
        <OfferingFilterSelect
          offerings={offerings}
          value={selectedId}
          onChange={setSelectedId}
          loading={loading}
        />
      </div>

      {!selected.waitlistEnabled ? (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Waitlist is off for{" "}
          <span className="font-medium text-foreground">{selected.name}</span>.
          Enable it on the offering Enrollment tab when you want a queue for
          full classes.
        </div>
      ) : null}

      <OfferingWaitlistPanel
        programId={selected.programId}
        offeringId={selected.id}
        offeringName={selected.name}
      />
    </div>
  )
}
