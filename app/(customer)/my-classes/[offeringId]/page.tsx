import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { userCanAccessOfferingRoster } from "@/lib/auth/portal-capabilities"
import { requireCustomerPortalPageContext } from "@/lib/auth/require-customer-portal-page"
import { getCustomerPortalSupabase } from "@/lib/auth/customer-portal-session"
import {
  getOfferingRosterEnrollments,
  getStaffAssignmentsForOffering,
} from "@/lib/programs/program-staff-assignment-queries"
import { PROGRAM_STAFF_ASSIGNMENT_ROLE_LABELS } from "@/lib/programs/program-staff-assignment-types"

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

export default async function MyClassRosterPage({
  params,
}: {
  params: Promise<{ offeringId: string }>
}) {
  const { offeringId } = await params
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
    .select("id, name, program_id, program:program_id ( name )")
    .eq("organization_id", organizationId)
    .eq("id", offeringId)
    .maybeSingle()

  if (offeringError || !offering) {
    notFound()
  }

  const [roster, staffAssignments, contactRow] = await Promise.all([
    getOfferingRosterEnrollments(offeringId, organizationId),
    getStaffAssignmentsForOffering(offeringId, organizationId),
    supabase
      .from("contacts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("auth_user_id", userId)
      .maybeSingle(),
  ])

  const program = offering.program as { name?: string } | null
  const myContactId = contactRow.data?.id as string | undefined
  const myAssignments = staffAssignments.filter(
    (assignment) => assignment.contact_id === myContactId
  )

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
          {program?.name || "Program"} · {offering.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Read-only participant roster for your assigned offering.
        </p>
        {myAssignments.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {myAssignments.map((assignment) => (
              <Badge key={assignment.id} variant="secondary">
                {
                  PROGRAM_STAFF_ASSIGNMENT_ROLE_LABELS[
                    assignment.assignment_role
                  ]
                }
                {assignment.session_name ? ` · ${assignment.session_name}` : ""}
              </Badge>
            ))}
          </div>
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
              No active enrollments for this offering yet.
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
    </div>
  )
}
