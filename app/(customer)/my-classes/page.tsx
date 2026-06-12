import Link from "next/link"
import { ArrowRight, GraduationCap } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireCustomerPortalPageContext } from "@/lib/auth/require-customer-portal-page"
import { getMyClassAssignments } from "@/lib/programs/program-staff-assignment-queries"
import { PROGRAM_STAFF_ASSIGNMENT_ROLE_LABELS } from "@/lib/programs/program-staff-assignment-types"

export default async function MyClassesPage() {
  const { userId, organizationId } = await requireCustomerPortalPageContext()

  const assignments = await getMyClassAssignments(organizationId, userId)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Classes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Programs and offerings where you are assigned as staff.
        </p>
      </div>

      {assignments.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            You do not have any class assignments yet. Assignments are managed
            from program offerings in the admin portal.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {assignments.map((assignment) => (
            <Card key={assignment.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">
                      {assignment.program_name}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {assignment.offering_name}
                      {assignment.session_name
                        ? ` · ${assignment.session_name}`
                        : ""}
                    </CardDescription>
                  </div>
                  <GraduationCap className="h-5 w-5 shrink-0 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {
                      PROGRAM_STAFF_ASSIGNMENT_ROLE_LABELS[
                        assignment.assignment_role
                      ]
                    }
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {assignment.enrollment_count} enrolled
                  </span>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/my-classes/${assignment.offering_id}`}>
                    View roster
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
