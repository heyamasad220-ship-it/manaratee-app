"use client"

import Link from "next/link"
import { GraduationCap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { ContactEnrollmentRecord } from "@/lib/contacts/contact-profile-data"
import { formatContactDate } from "@/lib/contacts/contact-profile-data"

type ContactProgramEnrollmentsPanelProps = {
  enrollments: ContactEnrollmentRecord[]
  loading?: boolean
}

function formatStatus(value?: string | null) {
  if (!value) return "—"
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export function ContactProgramEnrollmentsPanel({
  enrollments,
  loading = false,
}: ContactProgramEnrollmentsPanelProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <GraduationCap className="size-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Program enrollments</h2>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/programs/registrations">View registrations</Link>
          </Button>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          Programs this person is enrolled in as a participant. This is separate from MAS
          membership — enrolling in a class does not automatically make someone a member.
        </p>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading enrollments...</p>
        ) : enrollments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No program enrollments yet.</p>
        ) : (
          <ul className="space-y-3">
            {enrollments.map((enrollment) => (
              <li
                key={enrollment.id}
                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {enrollment.offeringName || enrollment.programName}
                  </p>
                  {enrollment.offeringName ? (
                    <p className="text-sm text-muted-foreground">{enrollment.programName}</p>
                  ) : null}
                  <p className="text-sm text-muted-foreground">
                    Enrolled {formatContactDate(enrollment.enrollmentDate)}
                  </p>
                </div>
                <Badge variant="secondary">{formatStatus(enrollment.status)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
