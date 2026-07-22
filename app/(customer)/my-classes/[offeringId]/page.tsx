import { notFound } from "next/navigation"

import { MyClassDetailClient } from "@/components/programs/my-class-detail-client"
import { userCanAccessOfferingRoster } from "@/lib/auth/portal-capabilities"
import { requireCustomerPortalPageContext } from "@/lib/auth/require-customer-portal-page"
import { getCustomerPortalSupabase } from "@/lib/auth/customer-portal-session"
import { getOfferingAttendanceForDate } from "@/lib/programs/program-attendance-actions"
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

  const { data: offering, error: offeringError } = await supabase
    .from("program_offerings")
    .select(
      "id, name, program_id, attendance_tracked, program:program_id ( name )"
    )
    .eq("organization_id", organizationId)
    .eq("id", offeringId)
    .maybeSingle()

  if (offeringError || !offering) {
    notFound()
  }

  const [roster, staffAssignments, contactRow, attendance] = await Promise.all([
    getOfferingRosterEnrollments(offeringId, organizationId),
    getStaffAssignmentsForOffering(offeringId, organizationId),
    supabase
      .from("contacts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("auth_user_id", userId)
      .maybeSingle(),
    getOfferingAttendanceForDate({
      offeringId,
      organizationId,
      attendanceDate,
    }).catch(() => []),
  ])

  const program = offering.program as { name?: string } | null
  const myContactId = contactRow.data?.id as string | undefined
  const myAssignments = staffAssignments.filter(
    (assignment) => assignment.contact_id === myContactId
  )

  return (
    <MyClassDetailClient
      userId={userId}
      organizationId={organizationId}
      offeringId={offeringId}
      programName={program?.name || "Program"}
      offeringName={offering.name as string}
      attendanceTracked={Boolean(offering.attendance_tracked)}
      roster={roster}
      staffAssignments={staffAssignments}
      myAssignments={myAssignments}
      initialAttendanceDate={attendanceDate}
      initialAttendance={attendance}
    />
  )
}
