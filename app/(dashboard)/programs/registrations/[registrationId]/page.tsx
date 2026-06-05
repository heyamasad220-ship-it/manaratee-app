import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  DollarSign,
  ExternalLink,
  Mail,
  Phone,
  Printer,
  User,
} from "lucide-react"

import { Header } from "@/components/layout/header"
import { RegistrationLifecycleActions } from "@/components/programs/registration-lifecycle-actions"
import { RegistrationChargeEditor } from "@/components/programs/registration-charge-editor"
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
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  contactLabel,
  canEditEnrollmentCharges,
  loadContactsByIds,
  shouldShowEnrollmentPaymentStatus,
} from "@/lib/programs/registration-display-helpers"
import { getEnrollmentChargeSchedule } from "@/lib/programs/program-billing-queries"
import { getEnrollmentChargeBundle } from "@/lib/programs/program-charge-queries"
import { CHARGE_SCHEDULE_STATUS_LABELS } from "@/lib/programs/program-billing-types"
import { getEnrollmentRegistrationDetail } from "@/lib/programs/registration-detail-queries"
import { isCarTagEligibleStatus } from "@/lib/programs/car-tag-types"

type PageParams = {
  registrationId: string
}

function formatDate(value: string | null | undefined) {
  if (!value) return "TBD"

  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "TBD"

  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatCurrency(value: number | null | undefined) {
  if (!value || value <= 0) return "$0"

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value)
}

function normalizeStatus(value: string | null | undefined) {
  if (!value) return "Unknown"

  return value
    .split("_")
    .join(" ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function getStatusBadgeVariant(status: string | null | undefined) {
  const normalized = (status || "").toLowerCase()

  if (normalized === "enrolled" || normalized === "active") return "default"
  if (normalized === "pending" || normalized === "pending_payment") {
    return "outline"
  }
  if (
    normalized === "cancelled" ||
    normalized === "canceled" ||
    normalized === "expired"
  ) {
    return "destructive"
  }

  return "secondary"
}

function getPaymentBadgeVariant(paymentStatus: string | null | undefined) {
  const status = (paymentStatus || "").toLowerCase()

  if (status === "paid") return "default"
  if (status === "pending") return "destructive"
  if (status === "partial") return "outline"

  return "secondary"
}

function DetailItem({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
}) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "Not set"}</p>
    </div>
  )
}

function formatLifecyclePayload(payload: unknown) {
  if (!payload || typeof payload !== "object") return "—"

  const entries = Object.entries(payload as Record<string, unknown>).filter(
    ([, value]) => value !== null && value !== undefined && value !== ""
  )

  if (entries.length === 0) return "—"

  return entries
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" · ")
}

export default async function RegistrationDetailPage({
  params,
}: {
  params: Promise<PageParams>
}) {
  const { registrationId } = await params
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    notFound()
  }

  const detail = await getEnrollmentRegistrationDetail(
    registrationId,
    organizationId
  )

  if (!detail) {
    notFound()
  }

  const { enrollment, sessionAccess, statusHistory, lifecycleEvents } = detail

  const program = enrollment.programs as {
    id: string
    name: string
    description: string | null
    start_date: string | null
    end_date: string | null
    capacity: number
    enrolled: number
    waitlist: number
    status: string
  } | null

  const offering = enrollment.program_offerings as {
    id: string
    name: string
    offering_type: string
    status: string
  } | null

  const registrationOption = enrollment.program_registration_options as {
    id: string
    name: string
    option_type: string
  } | null

  const registrationOptionLabel = registrationOption
    ? `${registrationOption.name} (${registrationOption.option_type})`
    : null

  const offeringLabel = offering
    ? `${offering.name} (${offering.offering_type})`
    : null

  const contactsById = await loadContactsByIds(organizationId, [
    enrollment.participant_contact_id,
    enrollment.registrant_contact_id,
    enrollment.payer_contact_id,
  ] as string[])

  const participantName = contactLabel(
    enrollment.participant_contact_id
      ? contactsById.get(enrollment.participant_contact_id)
      : undefined,
    enrollment.child_name
  )

  const registrantName = contactLabel(
    enrollment.registrant_contact_id
      ? contactsById.get(enrollment.registrant_contact_id)
      : undefined,
    enrollment.parent_name
  )

  const payerName = contactLabel(
    enrollment.payer_contact_id
      ? contactsById.get(enrollment.payer_contact_id)
      : undefined,
    enrollment.parent_name
  )

  const redirectTo = `/programs/registrations/${registrationId}`

  const chargeSchedule = await getEnrollmentChargeSchedule(
    organizationId,
    registrationId
  )

  const chargeBundle = await getEnrollmentChargeBundle(
    organizationId,
    registrationId,
    enrollment.charge_id as string | null
  )

  return (
    <>
      <Header title="Programs" />

      <div className="flex flex-col gap-6 p-6">
        <div>
          <Link
            href="/programs/registrations"
            className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Registrations
          </Link>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight">
                  Registration
                </h1>
                <Badge variant={getStatusBadgeVariant(enrollment.status)}>
                  {normalizeStatus(enrollment.status)}
                </Badge>
                {shouldShowEnrollmentPaymentStatus(enrollment.status) &&
                enrollment.payment_status ? (
                  <Badge
                    variant={getPaymentBadgeVariant(enrollment.payment_status)}
                  >
                    {normalizeStatus(enrollment.payment_status)}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-2 text-muted-foreground">
                {participantName} · {program?.name || "Unknown Program"}
              </p>
              <p className="text-xs text-muted-foreground">
                ID {enrollment.id}
              </p>
            </div>

            {program ? (
              <div className="flex flex-wrap gap-2">
                {isCarTagEligibleStatus(enrollment.status) ? (
                  <Button variant="outline" asChild>
                    <Link
                      href={`/programs/${program.id}/car-tags?enrollment=${enrollment.id}`}
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Print Car Tag
                    </Link>
                  </Button>
                ) : null}
                <Button variant="outline" asChild>
                  <Link href={`/programs/${program.id}/edit`}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Edit Program
                  </Link>
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        <RegistrationLifecycleActions
          enrollmentId={enrollment.id}
          status={enrollment.status}
          redirectTo={redirectTo}
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-full bg-muted p-3 text-blue-600">
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Participant</p>
                <p className="font-semibold">{participantName}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-full bg-muted p-3 text-green-600">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Registered</p>
                <p className="font-semibold">
                  {formatDate(
                    enrollment.enrollment_date || enrollment.created_at
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-full bg-muted p-3 text-purple-600">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="font-semibold">
                  {formatCurrency(enrollment.total_amount)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-full bg-muted p-3 text-amber-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Updated</p>
                <p className="font-semibold">
                  {formatDateTime(enrollment.updated_at || enrollment.created_at)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Registration Parties</CardTitle>
              <CardDescription>
                Participant, registrant, and payer for this registration.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <DetailItem label="Participant" value={participantName} />
              <DetailItem
                label="Participant Type"
                value={enrollment.participant_type}
              />
              <DetailItem label="Registrant" value={registrantName} />
              <DetailItem
                label="Registrant Type"
                value={enrollment.registrant_type}
              />
              <DetailItem label="Payer" value={payerName} />
              <DetailItem label="Child Age" value={enrollment.child_age} />

              <div>
                <p className="text-sm text-muted-foreground">Contact Email</p>
                {enrollment.parent_email ? (
                  <a
                    href={`mailto:${enrollment.parent_email}`}
                    className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
                  >
                    <Mail className="h-4 w-4" />
                    {enrollment.parent_email}
                  </a>
                ) : (
                  <p className="font-medium">Not set</p>
                )}
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Contact Phone</p>
                {enrollment.parent_phone ? (
                  <a
                    href={`tel:${enrollment.parent_phone}`}
                    className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
                  >
                    <Phone className="h-4 w-4" />
                    {enrollment.parent_phone}
                  </a>
                ) : (
                  <p className="font-medium">Not set</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Program Context</CardTitle>
              <CardDescription>
                Program, offering, and registration option for this record.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <DetailItem label="Program" value={program?.name} />
              <DetailItem label="Offering" value={offeringLabel} />
              <DetailItem
                label="Registration Option"
                value={registrationOptionLabel}
              />
              <DetailItem
                label="Status"
                value={normalizeStatus(enrollment.status)}
              />
              {program ? (
                <>
                  <DetailItem
                    label="Program Dates"
                    value={`${formatDate(program.start_date)} – ${formatDate(program.end_date)}`}
                  />
                  <DetailItem
                    label="Capacity"
                    value={`${program.enrolled}/${program.capacity}`}
                  />
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <RegistrationChargeEditor
          enrollmentId={registrationId}
          programId={program?.id ?? null}
          chargeBundle={chargeBundle}
          quoteSnapshot={enrollment.quote_snapshot}
          readOnly={!canEditEnrollmentCharges(enrollment.status)}
        />

        <Card>
          <CardHeader>
            <CardTitle>Charge Schedule</CardTitle>
            <CardDescription>
              Individual scheduled charges for this registration. Waive, adjust,
              or add fees from this page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chargeSchedule.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chargeSchedule.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.label}</TableCell>
                      <TableCell>{formatDate(item.due_date)}</TableCell>
                      <TableCell>{formatCurrency(item.amount)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {CHARGE_SCHEDULE_STATUS_LABELS[item.status] ||
                            item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.adjustment_reason || item.admin_notes || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">
                No charge schedule rows yet. Charges are created when
                registration is linked to the Phase 2B charge ledger.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session Access</CardTitle>
            <CardDescription>
              Sessions this registration has access to.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sessionAccess.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Access Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessionAccess.map((row) => {
                    const session = row.program_sessions as {
                      name: string
                      start_date: string | null
                      end_date: string | null
                    } | null

                    return (
                      <TableRow key={row.id as string}>
                        <TableCell className="font-medium">
                          {session?.name || row.session_id}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {session
                            ? `${formatDate(session.start_date)} – ${formatDate(session.end_date)}`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {normalizeStatus(row.access_status as string)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">
                No session access rows recorded.
                {enrollment.session_name
                  ? ` Legacy session: ${enrollment.session_name}`
                  : null}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Status History</CardTitle>
              <CardDescription>
                Enrollment status changes over time.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statusHistory.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statusHistory.map((row) => (
                      <TableRow key={row.id as string}>
                        <TableCell className="text-muted-foreground">
                          {formatDateTime(row.created_at as string)}
                        </TableCell>
                        <TableCell>
                          {normalizeStatus(row.from_status as string)}
                        </TableCell>
                        <TableCell>
                          {normalizeStatus(row.to_status as string)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {(row.reason as string) || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No status history recorded yet.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lifecycle Events</CardTitle>
              <CardDescription>
                Registration lifecycle audit trail.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lifecycleEvents.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lifecycleEvents.map((row) => (
                      <TableRow key={row.id as string}>
                        <TableCell className="text-muted-foreground">
                          {formatDateTime(row.created_at as string)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {normalizeStatus(row.action as string)}
                        </TableCell>
                        <TableCell>
                          {normalizeStatus(row.actor_type as string)}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground">
                          {formatLifecyclePayload(row.payload)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No lifecycle events recorded yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {enrollment.notes ? (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                {enrollment.notes}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  )
}
