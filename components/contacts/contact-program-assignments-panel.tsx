"use client"

import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PROGRAM_STAFF_ASSIGNMENT_ROLE_LABELS } from "@/lib/programs/program-staff-assignment-types"
import type { ProgramStaffAssignmentWithDetails } from "@/lib/programs/program-staff-assignment-types"

export function ContactProgramAssignmentsPanel({
  contactId,
  assignments,
}: {
  contactId: string
  assignments: ProgramStaffAssignmentWithDetails[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Program assignments</CardTitle>
        <CardDescription>
          Programs and sessions where this person is assigned as staff.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No program assignments yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {assignments.map((assignment) => (
              <li
                key={assignment.id}
                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium">
                    {assignment.program_name} · {assignment.offering_name}
                    {assignment.session_name ? ` · ${assignment.session_name}` : ""}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {
                        PROGRAM_STAFF_ASSIGNMENT_ROLE_LABELS[
                          assignment.assignment_role
                        ]
                      }
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {assignment.session_name
                        ? "Session assignment"
                        : "Program assignment"}
                    </span>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href={`/programs/${assignment.program_id}/offerings/${assignment.offering_id}?tab=staff`}
                  >
                    Manage
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
