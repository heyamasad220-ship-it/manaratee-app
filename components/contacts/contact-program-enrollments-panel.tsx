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

function money(value: number | null | undefined) {
  if (value == null) return null
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  })
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
          Programs linked to this contact as participant, registrant (parent/guardian), or payer.
          Enrolling in a class does not automatically create MAS membership.
        </p>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading enrollments...</p>
        ) : enrollments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No program enrollments yet.</p>
        ) : (
          <ul className="space-y-3">
            {enrollments.map((enrollment) => {
              const hasFa =
                enrollment.faOriginalAmount != null &&
                enrollment.faAssistedAmount != null
              const relationLabel =
                enrollment.relation === "registrant"
                  ? "Registrant"
                  : enrollment.relation === "payer"
                    ? "Payer"
                    : enrollment.relation === "child"
                      ? "Participant"
                      : "Participant"
              return (
                <li
                  key={enrollment.id}
                  className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">
                      {enrollment.offeringName || enrollment.programName}
                    </p>
                    {enrollment.offeringName ? (
                      <p className="text-sm text-muted-foreground">
                        {enrollment.programName}
                      </p>
                    ) : null}
                    {enrollment.childName ? (
                      <p className="text-sm text-muted-foreground">
                        Participant: {enrollment.childName}
                      </p>
                    ) : null}
                    <p className="text-sm text-muted-foreground">
                      {relationLabel} · Enrolled{" "}
                      {formatContactDate(enrollment.enrollmentDate)}
                    </p>
                    {hasFa ? (
                      <div className="mt-2 rounded-md bg-muted/50 px-2.5 py-2 text-sm">
                        <p className="font-medium text-foreground">
                          Financial assistance
                        </p>
                        <p className="text-muted-foreground">
                          Original fee {money(enrollment.faOriginalAmount)} →{" "}
                          assisted {money(enrollment.faAssistedAmount)}
                        </p>
                        {enrollment.faPlanLabel ? (
                          <p className="text-muted-foreground">
                            Plan: {enrollment.faPlanLabel}
                          </p>
                        ) : null}
                        {enrollment.faNote ? (
                          <p className="text-muted-foreground">
                            {enrollment.faNote}
                          </p>
                        ) : null}
                      </div>
                    ) : enrollment.totalAmount != null ? (
                      <p className="text-sm text-muted-foreground">
                        Fee {money(enrollment.totalAmount)}
                        {enrollment.amountPaid != null
                          ? ` · Received ${money(enrollment.amountPaid)}`
                          : null}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                    <Badge variant="secondary">
                      {formatStatus(enrollment.status)}
                    </Badge>
                    {hasFa ? (
                      <Badge variant="outline">FA applied</Badge>
                    ) : null}
                    <Button variant="link" size="sm" className="h-auto p-0" asChild>
                      <Link href={`/programs/registrations/${enrollment.id}`}>
                        View registration
                      </Link>
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
