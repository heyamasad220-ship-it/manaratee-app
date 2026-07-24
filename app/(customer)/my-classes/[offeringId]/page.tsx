import { notFound } from "next/navigation"

import { MyClassDetailClient } from "@/components/programs/my-class-detail-client"
import { userCanAccessOfferingRoster } from "@/lib/auth/portal-capabilities"
import { requireCustomerPortalPageContext } from "@/lib/auth/require-customer-portal-page"
import { getCustomerPortalSupabase } from "@/lib/auth/customer-portal-session"
import { getOfferingAttendanceForDate } from "@/lib/programs/program-attendance-queries"
import {
  getOfferingRosterEnrollments,
  getStaffAssignmentsForOffering,
} from "@/lib/programs/program-staff-assignment-queries"

function todayDateString() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function asProgramName(value: unknown): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const name = (value as { name?: unknown }).name
    if (typeof name === "string" && name.trim()) return name
  }
  if (Array.isArray(value) && value[0] && typeof value[0] === "object") {
    const name = (value[0] as { name?: unknown }).name
    if (typeof name === "string" && name.trim()) return name
  }
  return "Program"
}

export default async function MyClassRosterPage({
  params,
  searchParams,
}: {
  params: Promise<{ offeringId: string }>
  searchParams: Promise<{ date?: string }>
}) {
  const { offeringId } = await params
  const { date: dateParam } = await searchParams
  const attendanceDate =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : todayDateString()

  const { userId, organizationId } = await requireCustomerPortalPageContext()
  const { supabase } = await getCustomerPortalSupabase()

  const canAccess = await userCanAccessOfferingRoster({
    userId,
    organizationId,
    offeringId,
  })

  if (!canAccess) {
    notFound()
  }

  let offering: {
    id: string
    name: string
    program_id: string
    attendance_tracked?: boolean | null
    program?: unknown
  } | null = null

  {
    const withAttendance = await supabase
      .from("program_offerings")
      .select(
        "id, name, program_id, attendance_tracked, program:program_id ( name )"
      )
      .eq("organization_id", organizationId)
      .eq("id", offeringId)
      .maybeSingle()

    if (!withAttendance.error && withAttendance.data) {
      offering = withAttendance.data as typeof offering
    } else {
      // Column may be missing if migration 176/181 is not applied yet.
      const fallback = await supabase
        .from("program_offerings")
        .select("id, name, program_id, program:program_id ( name )")
        .eq("organization_id", organizationId)
        .eq("id", offeringId)
        .maybeSingle()

      if (fallback.error || !fallback.data) {
        notFound()
      }
      offering = fallback.data as typeof offering
    }
  }

  if (!offering) {
    notFound()
  }

  const [roster, staffAssignments, contactResult, attendance] =
    await Promise.all([
      getOfferingRosterEnrollments(offeringId, organizationId),
      getStaffAssignmentsForOffering(offeringId, organizationId),
      supabase
        .from("contacts")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("auth_user_id", userId)
        .limit(1)
        .maybeSingle(),
      getOfferingAttendanceForDate({
        offeringId,
        organizationId,
        attendanceDate,
      }),
    ])

  const myContactId = (contactResult.data?.id as string | undefined) ?? undefined
  const myAssignments = staffAssignments.filter(
    (assignment) => assignment.contact_id === myContactId
  )

  return (
    <MyClassDetailClient
      userId={userId}
      organizationId={organizationId}
      offeringId={offeringId}
      programName={asProgramName(offering.program)}
      offeringName={offering.name}
      attendanceTracked={Boolean(offering.attendance_tracked)}
      roster={roster}
      staffAssignments={staffAssignments}
      myAssignments={myAssignments}
      initialAttendanceDate={attendanceDate}
      initialAttendance={attendance}
    />
  )
}
