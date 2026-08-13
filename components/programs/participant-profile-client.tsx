"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type ReactNode } from "react"
import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Users,
} from "lucide-react"

import { PageBreadcrumbs } from "@/components/navigation/page-breadcrumbs"
import { ContactProfileCollapsibleSection } from "@/components/contacts/contact-profile-collapsible-section"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ParticipantProfileEditButton } from "@/components/programs/participant-profile-edit-dialog"
import { cn } from "@/lib/utils"

function getInitials(name: string) {
  return (name?.trim() || "?")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function formatPhoneNumber(phone: string | null | undefined) {
  if (!phone?.trim()) return null
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 11 && digits.startsWith("1")) {
    const national = digits.slice(1)
    return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return phone.trim()
}

/** Format any 10/11-digit phone sequences inside a free-text emergency contact line. */
function formatPhonesInText(value: string | null | undefined) {
  if (!value?.trim()) return null
  return value.replace(/\+?1?[\d\s().-]{9,}\d/g, (match) => {
    return formatPhoneNumber(match) || match
  })
}

function DetailItem({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value || "—"}</dd>
    </div>
  )
}

function EmptySection({ message }: { message: string }) {
  return <p className="py-2 text-sm text-muted-foreground">{message}</p>
}

export function ParticipantProfileClient({
  data,
  returnTo,
}: {
  data: ParticipantProfileData
  returnTo?: string | null
}) {
  const router = useRouter()
  const [householdOpen, setHouseholdOpen] = useState(true)
  const [enrollmentsOpen, setEnrollmentsOpen] = useState(true)
  const [attendanceOpen, setAttendanceOpen] = useState(true)
  const [waitlistOpen, setWaitlistOpen] = useState(false)
  const [applicationsOpen, setApplicationsOpen] = useState(false)
  const [sessionsOpen, setSessionsOpen] = useState(false)
  const [pickupOpen, setPickupOpen] = useState(false)

  const backHref = returnTo || "/programs/reports/enrollments"
  const emergencyContactLabel = formatPhonesInText(data.emergencyContact)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2"
          onClick={() => router.push(backHref)}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back
        </Button>
      </div>

      <PageBreadcrumbs
        items={[
          { label: "Reports", href: "/programs/reports/enrollments" },
          { label: "Enrollments", href: "/programs/reports/enrollments" },
          { label: data.fullName },
        ]}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <Avatar className="h-14 w-14 shrink-0 border border-border">
            <AvatarFallback className="bg-primary/10 text-base font-semibold text-primary">
              {getInitials(data.fullName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {data.fullName}
              </h1>
              <Badge variant="secondary" className="font-normal">
                Participant
              </Badge>
              {data.enrollments.some((row) => row.isActive) ? (
                <Badge>Active enrollment</Badge>
              ) : data.enrollments.length > 0 ? (
                <Badge variant="outline">No active enrollment</Badge>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {[
                data.dateOfBirthLabel !== "—"
                  ? `DOB ${data.dateOfBirthLabel}`
                  : null,
                data.age != null ? `Age ${data.age}` : null,
                data.gender,
                data.grade ? `Grade ${data.grade}` : null,
              ]
                .filter(Boolean)
                .join(" · ") || "Program participant profile"}
            </p>
            {data.linkedContactHref ? (
              <p className="text-sm">
                <Link
                  href={data.linkedContactHref}
                  className="text-primary hover:underline"
                >
                  Open linked contact profile
                </Link>
              </p>
            ) : null}
          </div>
        </div>
        <ParticipantProfileEditButton data={data} />
      </div>

      <div className="space-y-3">
        <div className="rounded-lg border px-4 py-3">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DetailItem label="Full name" value={data.fullName} />
            <DetailItem label="Date of birth" value={data.dateOfBirthLabel} />
            <DetailItem
              label="Age"
              value={data.age != null ? String(data.age) : "—"}
            />
            <DetailItem label="Gender" value={data.gender} />
            <DetailItem label="Grade" value={data.grade} />
            <DetailItem label="Allergies" value={data.allergies} />
            <DetailItem label="Photo consent" value={data.photoConsent} />
            <DetailItem
              label="Emergency contact"
              value={emergencyContactLabel}
            />
          </dl>
        </div>

        <ContactProfileCollapsibleSection
          title="Household"
          count={data.household.length}
          open={householdOpen}
          onOpenChange={setHouseholdOpen}
        >
          {data.household.length === 0 ? (
            <EmptySection message="No household relationships on file." />
          ) : (
            <ul className="divide-y">
              {data.household.map((member) => (
                <li
                  key={`${member.personId}-${member.relationshipType}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    {member.contactHref ? (
                      <Link
                        href={member.contactHref}
                        className="font-medium text-primary hover:underline"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {member.name}
                      </Link>
                    ) : (
                      <span className="font-medium">{member.name}</span>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {member.relationshipType}
                    </p>
                  </div>
                  {member.contactHref ? (
                    <Badge variant="outline" className="font-normal">
                      Contact
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="font-normal">
                      Family
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </ContactProfileCollapsibleSection>

        <ContactProfileCollapsibleSection
          title="Enrollments"
          count={data.enrollments.length}
          open={enrollmentsOpen}
          onOpenChange={setEnrollmentsOpen}
        >
          {data.enrollments.length === 0 ? (
            <EmptySection message="No enrollments found for this participant." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Offering</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Registrant</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.enrollments.map((enrollment) => (
                    <TableRow key={enrollment.id}>
                      <TableCell className="align-top">
                        <Link
                          href={enrollment.registrationHref}
                          className="font-medium text-primary hover:underline"
                        >
                          {enrollment.offeringName}
                        </Link>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {enrollment.childName}
                        </p>
                      </TableCell>
                      <TableCell className="align-top text-sm">
                        {enrollment.programName}
                      </TableCell>
                      <TableCell className="align-top text-sm">
                        {enrollment.departmentName}
                      </TableCell>
                      <TableCell className="align-top text-sm">
                        {enrollment.registrantHref ? (
                          <Link
                            href={enrollment.registrantHref}
                            className="text-primary hover:underline"
                          >
                            {enrollment.registrantName || "—"}
                          </Link>
                        ) : (
                          enrollment.registrantName || "—"
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge
                          variant={
                            enrollment.isActive ? "default" : "outline"
                          }
                        >
                          {enrollment.statusLabel}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </ContactProfileCollapsibleSection>

        <ContactProfileCollapsibleSection
          title="Attendance"
          count={data.attendance.length}
          open={attendanceOpen}
          onOpenChange={setAttendanceOpen}
        >
          {data.attendance.length === 0 ? (
            <EmptySection message="No attendance marks recorded yet." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Offering</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.attendance.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap">
                        {row.attendanceDateLabel}
                      </TableCell>
                      <TableCell>{row.offeringName}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            row.status === "present" &&
                              "border-emerald-200 bg-emerald-50 text-emerald-800",
                            row.status === "absent" &&
                              "border-red-200 bg-red-50 text-red-800",
                            row.status === "late" &&
                              "border-amber-200 bg-amber-50 text-amber-800"
                          )}
                        >
                          {row.statusLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.notes || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </ContactProfileCollapsibleSection>

        <ContactProfileCollapsibleSection
          title="Waitlist"
          count={data.waitlist.length}
          open={waitlistOpen}
          onOpenChange={setWaitlistOpen}
        >
          {data.waitlist.length === 0 ? (
            <EmptySection message="Not on any waitlists." />
          ) : (
            <ul className="space-y-2">
              {data.waitlist.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{row.offeringName}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.programName}
                    </p>
                  </div>
                  <Badge variant="outline">{row.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </ContactProfileCollapsibleSection>

        <ContactProfileCollapsibleSection
          title="Applications"
          count={data.applications.length}
          open={applicationsOpen}
          onOpenChange={setApplicationsOpen}
        >
          {data.applications.length === 0 ? (
            <EmptySection message="No applications on file." />
          ) : (
            <ul className="space-y-2">
              {data.applications.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{row.offeringName}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.programName}
                    </p>
                  </div>
                  <Badge variant="outline">{row.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </ContactProfileCollapsibleSection>

        <ContactProfileCollapsibleSection
          title="Session access"
          count={data.sessionAccess.length}
          open={sessionsOpen}
          onOpenChange={setSessionsOpen}
        >
          {data.sessionAccess.length === 0 ? (
            <EmptySection message="No session access rows." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session</TableHead>
                    <TableHead>Offering</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Access</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.sessionAccess.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {row.sessionName}
                      </TableCell>
                      <TableCell>{row.offeringName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {[row.startDate, row.endDate]
                          .filter(Boolean)
                          .join(" → ") || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.accessStatus}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </ContactProfileCollapsibleSection>

        <ContactProfileCollapsibleSection
          title="Authorized pickup / car tag"
          count={data.authorizedPickupNames.length}
          open={pickupOpen}
          onOpenChange={setPickupOpen}
        >
          {data.authorizedPickupNames.length === 0 ? (
            <EmptySection message="No authorized pickup names from family relationships." />
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.authorizedPickupNames.map((name) => (
                <Badge key={name} variant="secondary" className="font-normal">
                  <Users className="mr-1 h-3 w-3" />
                  {name}
                </Badge>
              ))}
            </div>
          )}
          {data.enrollments.some((row) => row.isActive) ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Printable car tags are available from each program’s car-tag tool
              when the enrollment is operational.
            </p>
          ) : null}
        </ContactProfileCollapsibleSection>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-muted-foreground">
          <GraduationCap className="h-4 w-4" />
          {data.enrollments.length} enrollment
          {data.enrollments.length === 1 ? "" : "s"}
        </div>
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          {data.attendance.length} attendance mark
          {data.attendance.length === 1 ? "" : "s"}
        </div>
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-muted-foreground">
          <ClipboardList className="h-4 w-4" />
          {data.applications.length + data.waitlist.length} application
          {data.applications.length + data.waitlist.length === 1 ? "" : "s"}
          /waitlist
        </div>
      </div>
    </div>
  )
}
