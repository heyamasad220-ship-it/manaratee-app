import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  DollarSign,
  Mail,
  Phone,
  User,
  Users,
  Utensils,
} from "lucide-react"

import { Header } from "@/components/layout/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { getSessionAccessForEnrollment } from "@/lib/programs/program-registration-session-access"
import {
  contactLabel,
  loadContactsByIds,
} from "@/lib/programs/registration-display-helpers"

import {
  cancelEnrollmentAction,
  advanceEnrollmentStatusAction,
  markEnrollmentPaymentAction,
  promoteWaitlistAction,
  removeWaitlistEntryAction,
} from "@/app/(dashboard)/programs/registrations/actions"
import {
  canCancelEnrollmentStatus,
  canPromoteWaitlist,
  forwardEnrollmentActionLabel,
  nextForwardEnrollmentStatus,
} from "@/lib/programs/program-lifecycle-types"

type PageParams = {
  type: string
  id: string
}

type EnrollmentDetail = {
  id: string
  organization_id: string | null
  program_id: string | null
  offering_id: string | null
  department_id: string | null
  registration_option_id: string | null
  participant_contact_id: string | null
  registrant_contact_id: string | null
  payer_contact_id: string | null
  participant_type: string | null
  registrant_type: string | null
  child_name: string
  child_age: number | null
  parent_name: string | null
  parent_email: string | null
  parent_phone: string | null
  session_name: string | null
  weeks: string[] | null
  enrollment_date: string | null
  status: string | null
  payment_status: string | null
  amount_paid: number | null
  total_amount: number | null
  before_care: boolean | null
  after_care: boolean | null
  lunch_type: string | null
  notes: string | null
  created_at: string | null
  updated_at: string | null
}

type WaitlistDetail = {
  id: string
  organization_id: string | null
  program_id: string | null
  child_name: string
  child_age: number | null
  parent_name: string | null
  parent_email: string | null
  parent_phone: string | null
  preferred_weeks: string[] | null
  added_date: string | null
  position: number | null
  status: string | null
  priority: string | null
  offer_expiry: string | null
  notes: string | null
  created_at: string | null
}

type Program = {
  id: string
  name: string
  description: string | null
  start_date: string | null
  end_date: string | null
  enrollment_open_date: string | null
  enrollment_close_date: string | null
  age_groups: string[]
  grade_levels: string[]
  gender: string | null
  capacity: number
  enrolled: number
  waitlist: number
  status: string
}

function formatDate(value: string | null) {
  if (!value) return "TBD"

  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatDateTime(value: string | null) {
  if (!value) return "TBD"

  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatCurrency(value: number | null) {
  if (!value || value <= 0) return "$0"

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value)
}

function normalizeStatus(value: string | null) {
  if (!value) return "Unknown"

  return value
    .split("_")
    .join(" ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function getPaymentBadgeVariant(paymentStatus: string | null) {
  const status = (paymentStatus || "").toLowerCase()

  if (status === "paid") return "default"
  if (status === "pending") return "destructive"
  if (status === "partial") return "outline"

  return "secondary"
}

function getStatusBadgeVariant(status: string | null, type: string) {
  const normalized = (status || "").toLowerCase()

  if (type === "waitlist") return "outline"
  if (normalized === "enrolled" || normalized === "active") return "default"
  if (normalized === "pending") return "outline"
  if (normalized === "cancelled" || normalized === "canceled") {
    return "destructive"
  }

  return "secondary"
}

function YesNoBadge({ value }: { value: boolean | null }) {
  return (
    <Badge variant={value ? "default" : "secondary"}>
      {value ? "Yes" : "No"}
    </Badge>
  )
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

export default async function ProgramRegistrationDetailPage({
  params,
}: {
  params: Promise<PageParams>
}) {
  const { type, id } = await params

  if (type !== "enrollment" && type !== "waitlist") {
    notFound()
  }

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  let enrollment: EnrollmentDetail | null = null
  let waitlist: WaitlistDetail | null = null
  let program: Program | null = null
  let registrationOptionName: string | null = null
  let sessionAccessRows: Awaited<ReturnType<typeof getSessionAccessForEnrollment>> = []

  if (type === "enrollment") {
    let enrollmentQuery = supabase.from("program_enrollments").select(
      `
        id,
        organization_id,
        program_id,
        offering_id,
        department_id,
        registration_option_id,
        participant_contact_id,
        registrant_contact_id,
        payer_contact_id,
        participant_type,
        registrant_type,
        child_name,
        child_age,
        parent_name,
        parent_email,
        parent_phone,
        session_name,
        weeks,
        enrollment_date,
        status,
        payment_status,
        amount_paid,
        total_amount,
        before_care,
        after_care,
        lunch_type,
        notes,
        created_at,
        updated_at
      `
    )

    if (organizationId) {
      enrollmentQuery = enrollmentQuery.eq("organization_id", organizationId)
    }

    const { data, error } = await enrollmentQuery.eq("id", id).maybeSingle()

    if (error || !data) {
      notFound()
    }

    enrollment = data as EnrollmentDetail

    if (enrollment.organization_id && enrollment.registration_option_id) {
      const { data: optionData } = await supabase
        .from("program_registration_options")
        .select("name, option_type")
        .eq("organization_id", enrollment.organization_id)
        .eq("id", enrollment.registration_option_id)
        .maybeSingle()

      registrationOptionName = optionData
        ? `${optionData.name} (${optionData.option_type})`
        : null
    }

    if (enrollment.organization_id) {
      sessionAccessRows = await getSessionAccessForEnrollment(
        enrollment.id,
        enrollment.organization_id
      )
    }
  }

  if (type === "waitlist") {
    let waitlistQuery = supabase.from("program_waitlist").select(
      `
        id,
        organization_id,
        program_id,
        child_name,
        child_age,
        parent_name,
        parent_email,
        parent_phone,
        preferred_weeks,
        added_date,
        position,
        status,
        priority,
        offer_expiry,
        notes,
        created_at
      `
    )

    if (organizationId) {
      waitlistQuery = waitlistQuery.eq("organization_id", organizationId)
    }

    const { data, error } = await waitlistQuery.eq("id", id).maybeSingle()

    if (error || !data) {
      notFound()
    }

    waitlist = data as WaitlistDetail
  }

  const programId =
    type === "enrollment" ? enrollment?.program_id : waitlist?.program_id

  if (programId) {
    const { data } = await supabase
      .from("programs")
      .select(
        `
        id,
        name,
        description,
        start_date,
        end_date,
        enrollment_open_date,
        enrollment_close_date,
        age_groups,
        grade_levels,
        gender,
        capacity,
        enrolled,
        waitlist,
        status
      `
      )
      .eq("id", programId)
      .maybeSingle()

    program = (data || null) as Program | null
  }

  const record = enrollment || waitlist

  if (!record) {
    notFound()
  }

  const contactsById =
    type === "enrollment" && enrollment?.organization_id
      ? await loadContactsByIds(enrollment.organization_id, [
          enrollment.participant_contact_id,
          enrollment.registrant_contact_id,
          enrollment.payer_contact_id,
        ] as string[])
      : new Map()

  const participantName =
    type === "enrollment" && enrollment
      ? contactLabel(
          enrollment.participant_contact_id
            ? contactsById.get(enrollment.participant_contact_id)
            : undefined,
          enrollment.child_name
        )
      : record.child_name

  const registrantName =
    type === "enrollment" && enrollment?.registrant_contact_id
      ? contactLabel(
          contactsById.get(enrollment.registrant_contact_id),
          enrollment.parent_name
        )
      : record.parent_name

  const payerName =
    type === "enrollment" && enrollment?.payer_contact_id
      ? contactLabel(
          contactsById.get(enrollment.payer_contact_id),
          enrollment.parent_name
        )
      : record.parent_name
  const childAge = record.child_age
  const parentName = record.parent_name
  const parentEmail = record.parent_email
  const parentPhone = record.parent_phone
  const notes = record.notes

  const detailPath = `/programs/registrations/${type}/${id}`

  const registeredDate =
    type === "enrollment"
      ? enrollment?.enrollment_date || enrollment?.created_at || null
      : waitlist?.added_date || waitlist?.created_at || null

  const weeks =
    type === "enrollment"
      ? sessionAccessRows.length > 0
        ? sessionAccessRows.map((row) => row.session_id as string)
        : enrollment?.weeks || []
      : waitlist?.preferred_weeks || []

  const canMoveWaitlist =
    type === "waitlist" &&
    program &&
    canPromoteWaitlist(waitlist?.status, program)

  const enrollmentStatus = (enrollment?.status || "").toLowerCase()
  const nextStatus = nextForwardEnrollmentStatus(enrollmentStatus)
  const showCancel = type === "enrollment" && canCancelEnrollmentStatus(enrollmentStatus)

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
                  {participantName}
                </h1>

                <Badge variant={type === "enrollment" ? "default" : "outline"}>
                  {type === "enrollment" ? "Enrollment" : "Waitlist"}
                </Badge>

                <Badge variant={getStatusBadgeVariant(record.status, type)}>
                  {normalizeStatus(record.status)}
                </Badge>
              </div>

              <p className="mt-2 text-muted-foreground">
                {program?.name || "Unknown Program"}
              </p>
            </div>

            {program ? (
              <Button variant="outline" asChild>
                <Link href={`/programs/${program.id}`}>View Program</Link>
              </Button>
            ) : null}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Admin Actions</CardTitle>
            <CardDescription>
              Manage this registration record. Actions update the related program counters.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {type === "enrollment" && enrollment ? (
              <>
                <form action={markEnrollmentPaymentAction}>
                  <input type="hidden" name="enrollment_id" value={enrollment.id} />
                  <input type="hidden" name="payment_status" value="paid" />
                  <input type="hidden" name="redirect_to" value={detailPath} />
                  <Button type="submit" variant="outline">
                    Mark Paid
                  </Button>
                </form>

                <form action={markEnrollmentPaymentAction}>
                  <input type="hidden" name="enrollment_id" value={enrollment.id} />
                  <input type="hidden" name="payment_status" value="partial" />
                  <input type="hidden" name="redirect_to" value={detailPath} />
                  <Button type="submit" variant="outline">
                    Mark Partial
                  </Button>
                </form>

                <form action={markEnrollmentPaymentAction}>
                  <input type="hidden" name="enrollment_id" value={enrollment.id} />
                  <input type="hidden" name="payment_status" value="pending" />
                  <input type="hidden" name="redirect_to" value={detailPath} />
                  <Button type="submit" variant="outline">
                    Mark Pending
                  </Button>
                </form>

                {nextStatus ? (
                  <form action={advanceEnrollmentStatusAction}>
                    <input type="hidden" name="enrollment_id" value={enrollment.id} />
                    <input type="hidden" name="target_status" value={nextStatus} />
                    <input type="hidden" name="redirect_to" value={detailPath} />
                    <Button type="submit">
                      {forwardEnrollmentActionLabel(nextStatus)}
                    </Button>
                  </form>
                ) : null}

                {showCancel ? (
                  <form action={cancelEnrollmentAction}>
                    <input type="hidden" name="enrollment_id" value={enrollment.id} />
                    <input type="hidden" name="redirect_to" value={detailPath} />
                    <Button type="submit" variant="destructive">
                      Cancel Enrollment
                    </Button>
                  </form>
                ) : null}
              </>
            ) : null}

            {type === "waitlist" && waitlist ? (
              <>
                <form action={promoteWaitlistAction}>
                  <input type="hidden" name="waitlist_id" value={waitlist.id} />
                  <input type="hidden" name="redirect_to" value={detailPath} />
                  <Button type="submit" disabled={!canMoveWaitlist}>
                    Promote to Registration
                  </Button>
                </form>

                <form action={removeWaitlistEntryAction}>
                  <input type="hidden" name="waitlist_id" value={waitlist.id} />
                  <input type="hidden" name="redirect_to" value={detailPath} />
                  <Button type="submit" variant="destructive">
                    Remove from Waitlist
                  </Button>
                </form>

                {!canMoveWaitlist ? (
                  <p className="flex items-center text-sm text-muted-foreground">
                    This waitlist entry cannot be promoted because the program is full or the entry is no longer active.
                  </p>
                ) : null}
              </>
            ) : null}
          </CardContent>
        </Card>

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
                <p className="font-semibold">{formatDate(registeredDate)}</p>
              </div>
            </CardContent>
          </Card>

          {type === "enrollment" ? (
            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="rounded-full bg-muted p-3 text-purple-600">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="font-semibold">
                    {formatCurrency(enrollment?.total_amount || 0)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="rounded-full bg-muted p-3 text-orange-600">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Position</p>
                  <p className="font-semibold">
                    {waitlist?.position ? `#${waitlist.position}` : "Not set"}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-full bg-muted p-3 text-amber-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Updated</p>
                <p className="font-semibold">
                  {type === "enrollment"
                    ? formatDateTime(enrollment?.updated_at || enrollment?.created_at || null)
                    : formatDateTime(waitlist?.created_at || null)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Participant & Contact</CardTitle>
              <CardDescription>
                Customer-submitted registration information.
              </CardDescription>
            </CardHeader>

            <CardContent className="grid gap-5 sm:grid-cols-2">
              <DetailItem label="Participant" value={participantName} />
              <DetailItem label="Participant Type" value={enrollment?.participant_type} />
              <DetailItem label="Registrant" value={registrantName} />
              <DetailItem label="Registrant Type" value={enrollment?.registrant_type} />
              <DetailItem label="Payer" value={payerName} />
              <DetailItem label="Registration Option" value={registrationOptionName} />
              <DetailItem label="Child Age" value={childAge} />
              <DetailItem label="Parent Name" value={parentName} />

              <div>
                <p className="text-sm text-muted-foreground">Parent Email</p>
                {parentEmail ? (
                  <a
                    href={`mailto:${parentEmail}`}
                    className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
                  >
                    <Mail className="h-4 w-4" />
                    {parentEmail}
                  </a>
                ) : (
                  <p className="font-medium">Not set</p>
                )}
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Parent Phone</p>
                {parentPhone ? (
                  <a
                    href={`tel:${parentPhone}`}
                    className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
                  >
                    <Phone className="h-4 w-4" />
                    {parentPhone}
                  </a>
                ) : (
                  <p className="font-medium">Not set</p>
                )}
              </div>

              <DetailItem label="Record ID" value={record.id} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Program</CardTitle>
              <CardDescription>Program connected to this record.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {program ? (
                <>
                  <div>
                    <p className="font-semibold">{program.name}</p>
                    <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                      {program.description || "No description provided."}
                    </p>
                  </div>

                  <div className="grid gap-3 text-sm">
                    <DetailItem
                      label="Program Dates"
                      value={`${formatDate(program.start_date)} – ${formatDate(
                        program.end_date
                      )}`}
                    />
                    <DetailItem label="Gender" value={program.gender || "All"} />
                    <DetailItem
                      label="Capacity"
                      value={`${program.enrolled}/${program.capacity}`}
                    />
                    <DetailItem label="Waitlist" value={program.waitlist} />
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No connected program found.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {type === "enrollment" && enrollment ? (
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Enrollment Details</CardTitle>
                <CardDescription>
                  Session, weeks, care options, and notes.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="grid gap-5 sm:grid-cols-2">
                  <DetailItem label="Session Name" value={enrollment.session_name} />
                  <DetailItem
                    label="Enrollment Date"
                    value={formatDate(enrollment.enrollment_date)}
                  />

                  <div>
                    <p className="text-sm text-muted-foreground">Before Care</p>
                    <div className="mt-1">
                      <YesNoBadge value={enrollment.before_care} />
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">After Care</p>
                    <div className="mt-1">
                      <YesNoBadge value={enrollment.after_care} />
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">Lunch Type</p>
                    <p className="inline-flex items-center gap-2 font-medium">
                      <Utensils className="h-4 w-4" />
                      {enrollment.lunch_type || "Not set"}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm text-muted-foreground">Weeks</p>
                  {weeks.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {weeks.map((week) => (
                        <Badge key={week} variant="secondary">
                          {week}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm font-medium">Not set</p>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-sm text-muted-foreground">Notes</p>
                  <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                    {notes || "No notes provided."}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment</CardTitle>
                <CardDescription>Payment status and totals.</CardDescription>
              </CardHeader>

              <CardContent className="space-y-5">
                <div>
                  <p className="text-sm text-muted-foreground">Payment Status</p>
                  <div className="mt-1">
                    <Badge variant={getPaymentBadgeVariant(enrollment.payment_status)}>
                      {normalizeStatus(enrollment.payment_status)}
                    </Badge>
                  </div>
                </div>

                <DetailItem
                  label="Amount Paid"
                  value={formatCurrency(enrollment.amount_paid)}
                />

                <DetailItem
                  label="Total Amount"
                  value={formatCurrency(enrollment.total_amount)}
                />

                <DetailItem
                  label="Balance"
                  value={formatCurrency(
                    Math.max(
                      Number(enrollment.total_amount || 0) -
                        Number(enrollment.amount_paid || 0),
                      0
                    )
                  )}
                />
              </CardContent>
            </Card>
          </div>
        ) : null}

        {type === "waitlist" && waitlist ? (
          <Card>
            <CardHeader>
              <CardTitle>Waitlist Details</CardTitle>
              <CardDescription>
                Priority, preferred weeks, offer expiry, and notes.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <DetailItem label="Added Date" value={formatDate(waitlist.added_date)} />
                <DetailItem label="Position" value={waitlist.position} />
                <DetailItem label="Priority" value={normalizeStatus(waitlist.priority)} />
                <DetailItem label="Offer Expiry" value={formatDate(waitlist.offer_expiry)} />
              </div>

              <div>
                <p className="mb-2 text-sm text-muted-foreground">
                  Preferred Weeks
                </p>
                {weeks.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {weeks.map((week) => (
                      <Badge key={week} variant="secondary">
                        {week}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm font-medium">Not set</p>
                )}
              </div>

              <div>
                <p className="mb-2 text-sm text-muted-foreground">Notes</p>
                <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                  {notes || "No notes provided."}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  )
}
