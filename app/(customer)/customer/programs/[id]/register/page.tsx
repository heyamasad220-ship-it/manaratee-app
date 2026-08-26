import Link from "next/link"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
  GraduationCap,
  UserCircle2,
  UserRound,
  Utensils,
  Users,
} from "lucide-react"

import { ProgramRegisterSessionFields } from "@/components/customer/program-register-session-fields"
import { ProgramRegisterQuotePreview } from "@/components/customer/program-register-quote-preview"
import { ProgramRegisterParticipantsFields } from "@/components/customer/program-register-participants-fields"
import { CustomerRegistrationOptionPicker } from "@/components/programs/program-registration-options-editor"
import { createClient } from "@/lib/supabase/server"
import { resolveCustomerPortalSession } from "@/lib/auth/customer-portal-session"
import { resolveSessionEffectiveCapacity } from "@/lib/programs/program-catalog-capacity"
import { getDefaultOfferingForProgramByOrg, getOfferingByIdForOrg } from "@/lib/programs/program-offering-queries"
import { registerForProgram } from "@/lib/programs/program-registration-actions"
import {
  getRegistrationOptionsForOffering,
  isRegistrationOptionAvailable,
} from "@/lib/programs/program-registration-option-queries"
import {
  formatProgramAgeRangeShort,
  formatProgramGenderLabel,
  formatProgramGradeRangeShort,
} from "@/lib/programs/program-eligibility-display"
import { enrollmentStatusBlocksDuplicate } from "@/lib/programs/enrollment-status-helpers"
import {
  applicationCoversOffering,
  customerProgramApplyPath,
  isApplicationBasedProgram,
  isApprovedRegistrationPending,
} from "@/lib/programs/enrollment-process"
import { getApplicationsForRegistrantContact } from "@/lib/programs/program-application-actions"
import { lookupContactsByPersonIds } from "@/lib/programs/registration-contact-resolver"
import { getMyOrganizations } from "@/lib/organizations/get-my-organizations"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type CustomerOrganization = {
  organization_id: string
  organization_name: string
  role_name: string
}

type Program = {
  id: string
  organization_id: string
  name: string
  description: string | null
  department_id: string | null
  program_type: string | null
  start_date: string | null
  end_date: string | null
  enrollment_open_date: string | null
  enrollment_close_date: string | null
  age_groups: string[] | null
  min_age: number | null
  max_age: number | null
  grade_levels: string[] | null
  gender: string | null
  capacity: number
  enrolled: number
  waitlist: number
  status: string
  enrollment_process?: string | null
  program_kind?: string | null
}

type ProgramSession = {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
  capacity: number | null
  enrolled: number | null
  price: number | null
}

type LunchOption = {
  id: string
  name: string
  price: number | null
}

type CustomerContact = {
  id: string
  organization_id: string
  person_id: string | null
  full_name: string | null
  email: string | null
  phone: string | null
}

type FamilyMember = {
  personId: string
  contactId: string | null
  first_name: string
  last_name: string
  date_of_birth: string | null
  gender: string | null
  relationship_type: string
}

function formatDate(date?: string | null) {
  if (!date) return "Not set"

  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatMoney(value?: number | null) {
  const amount = Number(value || 0)

  if (amount <= 0) return "Included"

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

function isEnrollmentOpen(open?: string | null, close?: string | null) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const openDate = open ? new Date(`${open}T00:00:00`) : null
  const closeDate = close ? new Date(`${close}T00:00:00`) : null

  if (openDate && today < openDate) return false
  if (closeDate && today > closeDate) return false

  return true
}

function seatsRemaining(program: Program) {
  return Math.max((program.capacity || 0) - (program.enrolled || 0), 0)
}

function sessionSeatsRemaining(
  session: ProgramSession,
  offering?: {
    capacity_mode?: string | null
    capacity?: number | null
  } | null
) {
  const capacity = resolveSessionEffectiveCapacity(session.capacity, offering)
  if (capacity <= 0) return Number.POSITIVE_INFINITY
  return Math.max(capacity - (session.enrolled || 0), 0)
}

function isFull(program: Program) {
  return program.capacity > 0 && program.enrolled >= program.capacity
}

function getRegistrationMode(
  program: Program,
  sessions: Array<{ remaining: number }>
) {
  const enrollmentOpen = isEnrollmentOpen(
    program.enrollment_open_date,
    program.enrollment_close_date
  )

  if (!enrollmentOpen) return "closed"

  // Multi-session offerings: full only when every session is full.
  if (sessions.length > 0) {
    const anyOpen = sessions.some(
      (session) =>
        !Number.isFinite(session.remaining) || session.remaining > 0
    )
    if (!anyOpen) return program.waitlist > 0 ? "waitlist" : "full"
    return "enroll"
  }

  if (isFull(program)) return program.waitlist > 0 ? "waitlist" : "full"
  return "enroll"
}

async function getActiveCustomerOrganization() {
  const cookieStore = await cookies()
  const activeOrganizationId = cookieStore.get("active_organization_id")?.value

  const customerOrganizations = (await getMyOrganizations()) as CustomerOrganization[]

  if (customerOrganizations.length === 0) {
    return {
      organization: null,
      errorMessage: "You are not connected to an organization yet.",
    }
  }

  const activeOrganization =
    customerOrganizations.find(
      (org) => org.organization_id === activeOrganizationId
    ) || customerOrganizations[0]

  return {
    organization: activeOrganization,
    errorMessage: null,
  }
}

async function getCurrentCustomerContact(organizationId: string) {
  const session = await resolveCustomerPortalSession()
  if (!session) return null

  const supabase = session.isSupportSession
    ? (await import("@/lib/platform/require-platform-admin")).getServiceRoleClient()
    : await createClient()

  const { data, error } = await supabase
    .from("contacts")
    .select("id, organization_id, person_id, full_name, email, phone")
    .eq("auth_user_id", session.effectiveUserId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error) {
    console.error("Customer contact load error:", error)
    return null
  }

  return data as CustomerContact | null
}

async function getFamilyMembers(
  parentPersonId: string,
  organizationId: string
): Promise<FamilyMember[]> {
  const supabase = await createClient()

  const { data: relationships, error: relationshipError } = await supabase
    .from("person_relationships")
    .select("related_person_id, relationship_type")
    .eq("organization_id", organizationId)
    .eq("person_id", parentPersonId)

  if (relationshipError) {
    console.error("Family relationships load error:", relationshipError)
    return []
  }

  const personIds = (relationships || []).map((row) => row.related_person_id as string)

  if (personIds.length === 0) return []

  const { data: people, error: peopleError } = await supabase
    .from("people")
    .select("id, first_name, last_name, date_of_birth, gender")
    .eq("organization_id", organizationId)
    .in("id", personIds)

  if (peopleError) {
    console.error("Family people load error:", peopleError)
    return []
  }

  const contactByPersonId = await lookupContactsByPersonIds(
    organizationId,
    personIds
  )

  return (relationships || [])
    .map((relationship) => {
      const person = (people || []).find(
        (row) => row.id === relationship.related_person_id
      )

      if (!person) return null

      const age = (() => {
        if (!person.date_of_birth) return null
        const today = new Date()
        const birth = new Date(`${person.date_of_birth}T00:00:00`)
        let years = today.getFullYear() - birth.getFullYear()
        const monthDiff = today.getMonth() - birth.getMonth()
        if (
          monthDiff < 0 ||
          (monthDiff === 0 && today.getDate() < birth.getDate())
        ) {
          years--
        }
        return years
      })()

      // Minors never expose a contact id for registration — Contact + Participant.
      const contactId =
        age !== null && age < 18
          ? null
          : (contactByPersonId.get(person.id as string) ?? null)

      return {
        personId: person.id as string,
        contactId,
        first_name: person.first_name || "",
        last_name: person.last_name || "",
        date_of_birth: person.date_of_birth,
        gender: person.gender,
        relationship_type: relationship.relationship_type as string,
      }
    })
    .filter(Boolean) as FamilyMember[]
}

async function getActiveEnrollmentByPersonId(
  organizationId: string,
  programId: string,
  participantPersonIds: string[]
) {
  const uniquePersonIds = [...new Set(participantPersonIds.filter(Boolean))]

  if (uniquePersonIds.length === 0) {
    return new Map<string, string>()
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("program_enrollments")
    .select("child_person_id, status")
    .eq("organization_id", organizationId)
    .eq("program_id", programId)
    .in("child_person_id", uniquePersonIds)

  if (error) {
    console.error("Enrollment lookup for registration:", error.message)
    return new Map<string, string>()
  }

  const activeByPersonId = new Map<string, string>()

  for (const row of data || []) {
    const personId = row.child_person_id as string | null
    const status = row.status as string | null

    if (personId && enrollmentStatusBlocksDuplicate(status)) {
      activeByPersonId.set(personId, status || "active")
    }
  }

  return activeByPersonId
}

type RegisterSearchParams = {
  offering?: string | string[]
  error?: string | string[]
}

function getSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function CustomerProgramRegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<RegisterSearchParams>
}) {
  const { id } = await params
  const resolvedSearchParams = await searchParams
  const offeringParam = getSearchParam(resolvedSearchParams?.offering)
  const supabase = await createClient()

  const { organization, errorMessage } = await getActiveCustomerOrganization()

  if (errorMessage || !organization) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] px-6 py-8">
        <div className="mx-auto max-w-4xl">
          <Card>
            <CardContent className="flex min-h-[260px] flex-col items-center justify-center p-8 text-center">
              <BookOpen className="mb-4 h-10 w-10 text-muted-foreground" />
              <h1 className="text-lg font-semibold">Unable to register</h1>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                {errorMessage || "You are not connected to an organization yet."}
              </p>
              <Button className="mt-6" asChild>
                <Link href="/customer/programs">Back to Programs</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const organizationId = organization.organization_id
  const customerContact = await getCurrentCustomerContact(organizationId)

  const { data, error } = await supabase
    .from("programs")
    .select(
      `
      id,
      organization_id,
      name,
      description,
      department_id,
      program_type,
      start_date,
      end_date,
      enrollment_open_date,
      enrollment_close_date,
      age_groups,
      min_age,
      max_age,
      grade_levels,
      gender,
      capacity,
      enrolled,
      waitlist,
      status,
      enrollment_process,
      program_kind
    `
    )
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .maybeSingle()

  if (error || !data) {
    notFound()
  }

  const program = data as Program
  const isAdultProgram = program.program_type === "adult"

  const offering = offeringParam
    ? await getOfferingByIdForOrg(offeringParam, organizationId)
    : await getDefaultOfferingForProgramByOrg(program.id, organizationId)

  if (!offering || offering.program_id !== program.id) {
    notFound()
  }

  if (
    offering.status === "draft" ||
    offering.status === "archived" ||
    offering.status === "cancelled"
  ) {
    notFound()
  }

  if (isApplicationBasedProgram(program)) {
    if (!customerContact?.id) {
      redirect(customerProgramApplyPath(program.id, offering.id, "approval-required"))
    }
    const applications = await getApplicationsForRegistrantContact(
      organizationId,
      customerContact.id,
      program.id
    )
    const hasApprovedForOffering = applications.some(
      (application) =>
        isApprovedRegistrationPending(application) &&
        applicationCoversOffering(application, offering.id)
    )
    if (!hasApprovedForOffering) {
      redirect(customerProgramApplyPath(program.id, offering.id, "approval-required"))
    }
  }

  const allOptions = offering
    ? await getRegistrationOptionsForOffering(offering.id, organizationId)
    : []

  const registrationOptions = allOptions.filter((option) =>
    isRegistrationOptionAvailable(option)
  )

  const familyMembers =
    !isAdultProgram && customerContact?.person_id
      ? await getFamilyMembers(customerContact.person_id, organizationId)
      : []

  const activeEnrollmentByPersonId = await getActiveEnrollmentByPersonId(
    organizationId,
    program.id,
    familyMembers.map((member) => member.personId)
  )

  const sessionQuery = supabase
    .from("program_sessions")
    .select(
      "id, name, start_date, end_date, capacity, enrolled, price, status, sort_order, offering_id"
    )
    .eq("organization_id", organizationId)
    .eq("program_id", program.id)
    .eq("status", "active")

  const { data: sessionData } = offering.is_default
    ? await sessionQuery.or(`offering_id.eq.${offering.id},offering_id.is.null`)
    : await sessionQuery.eq("offering_id", offering.id)
    .order("sort_order", { ascending: true })
    .order("start_date", { ascending: true })

  const sessions = ((sessionData || []) as ProgramSession[]).map((session) => {
    const remaining = sessionSeatsRemaining(session, offering)
    return {
      ...session,
      remaining: Number.isFinite(remaining) ? remaining : 9999,
    }
  })

  const { data: lunchData } = await supabase
    .from("program_lunch_options")
    .select("id, name, price")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  const lunchOptions = (lunchData || []) as LunchOption[]

  const enrollmentOpen = isEnrollmentOpen(
    offering.enrollment_open_date ?? program.enrollment_open_date,
    offering.enrollment_close_date ?? program.enrollment_close_date
  )

  const mode = enrollmentOpen
    ? getRegistrationMode(program, sessions)
    : "closed"
  const remainingSeats =
    sessions.length > 0
      ? Math.max(
          ...sessions.map((session) =>
            Number.isFinite(session.remaining) ? session.remaining : 0
          ),
          0
        )
      : seatsRemaining(program)

  if (mode === "closed" || mode === "full") {
    return (
      <div className="min-h-screen bg-[#f5f5f7] px-6 py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <Link
            href={`/customer/programs/${program.id}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Program
          </Link>

          <Card>
            <CardContent className="flex min-h-[260px] flex-col items-center justify-center p-8 text-center">
              <BookOpen className="mb-4 h-10 w-10 text-muted-foreground" />
              <h1 className="text-lg font-semibold">
                Registration is not available
              </h1>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                This program is currently {mode === "closed" ? "closed" : "full"}.
              </p>
              <Button className="mt-6" asChild>
                <Link href={`/customer/programs/${program.id}`}>View Program</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const errorMessages: Record<string, string> = {
    unauthorized:
      "Your account is not authorized to register for this organization. Make sure you are signed in and linked to a contact record.",
    "capacity-full":
      "One or more selected weeks are full. Choose different weeks or join the waitlist if available.",
    "selected-weeks-priority":
      "Selected weeks are on the waitlist until staff opens remaining seats. Register for all of Camp 1 or Camp 2 to enroll now, or enable waitlist.",
    "missing-fields": "Please complete all required fields before continuing.",
    "invalid-participant": "The selected participant could not be found.",
    "missing-participant-contact":
      "This participant does not have a linked contact record yet. Contact your organization administrator to complete contact migration before registering.",
    "invalid-session": "One or more selected sessions could not be found.",
    "invalid-lunch": "The selected lunch option could not be found.",
    "no-fee-plan":
      "This program does not have a fee plan configured. Contact the organization.",
    "invalid-fee-plan":
      "This registration option references an invalid fee plan. Contact the organization.",
    "pricing-error":
      "We could not calculate pricing for this registration. Please try again or contact support.",
    "invalid-option": "The selected registration option is not available.",
    "invalid-offering": "This program offering is not available.",
    "invalid-registrant": "Your registrant contact could not be verified.",
    "invalid-payer": "The payer contact could not be verified.",
    "already-enrolled":
      "This participant already has an active registration for this program. If a prior registration was cancelled, ask staff to confirm it shows Cancelled, then try again.",
    "already-waitlisted":
      "This participant is already on the waitlist for this program.",
    "save-failed": "We could not save this registration. Please try again.",
  }

  const canRegister =
    customerContact &&
    (isAdultProgram || (customerContact.person_id && familyMembers.length > 0))

  const ageRangeLabel = formatProgramAgeRangeShort(program)
  const gradeRangeLabel = formatProgramGradeRangeShort(program.grade_levels)

  return (
    <div className="min-h-screen bg-[#f5f5f7] px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link
          href={`/customer/programs/${program.id}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Program
        </Link>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-3">
                  <CardTitle>
                    {mode === "waitlist"
                      ? `Join waitlist — ${offering.name}`
                      : `Register for ${offering.name}`}
                  </CardTitle>
                  <Badge
                    className={
                      mode === "waitlist"
                        ? "bg-amber-600 hover:bg-amber-600"
                        : "bg-emerald-600 hover:bg-emerald-600"
                    }
                  >
                    {mode === "waitlist" ? "Waitlist" : "Open"}
                  </Badge>
                </div>
                <CardDescription>
                  Part of {program.name}. Choose a registration option, then
                  complete the form below.
                  {offering.selected_sessions_open === false
                    ? " Full Camp 1 or Camp 2 enrolls now; selected weeks join the waitlist until remaining seats open."
                    : ""}
                </CardDescription>
              </CardHeader>

              <CardContent>
                {getSearchParam(resolvedSearchParams?.error) ? (
                  <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errorMessages[getSearchParam(resolvedSearchParams?.error) || ""] ||
                      "Something went wrong. Please try again."}
                  </div>
                ) : null}

                {!customerContact ? (
                  <div className="rounded-lg border border-dashed p-8 text-center">
                    <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                    <h3 className="font-medium">Customer contact required</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Your account is not linked to a contact record for this
                      organization.
                    </p>
                    <Button className="mt-4" asChild>
                      <Link href="/customer/profile">Go to Profile</Link>
                    </Button>
                  </div>
                ) : !canRegister ? (
                  <div className="rounded-lg border border-dashed p-8 text-center">
                    <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                    <h3 className="font-medium">No family members found</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Add a child or grandchild to your profile before registering
                      for this youth program.
                    </p>
                    <Button className="mt-4" asChild>
                      <Link href="/customer/profile">Add Family Member</Link>
                    </Button>
                  </div>
                ) : registrationOptions.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Registration options have not been configured for this program
                    yet.
                  </div>
                ) : (
                  <form id="program-register-form" action={registerForProgram} className="space-y-6">
                    <input type="hidden" name="program_id" value={program.id} />
                    <input type="hidden" name="offering_id" value={offering.id} />
                    <input type="hidden" name="mode" value={mode} />

                    <CustomerRegistrationOptionPicker options={registrationOptions} />

                    {isAdultProgram ? (
                      <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                        <p className="font-medium">Participant</p>
                        <p className="mt-1 text-muted-foreground">
                          You are registering yourself as{" "}
                          {customerContact.full_name || "the participant"}.
                        </p>
                      </div>
                    ) : (
                      <ProgramRegisterParticipantsFields
                        familyMembers={familyMembers}
                        lunchOptions={lunchOptions}
                        showAddons={mode !== "waitlist"}
                        activeEnrollmentByPersonId={Object.fromEntries(
                          activeEnrollmentByPersonId
                        )}
                      />
                    )}

                    {isAdultProgram && mode !== "waitlist" ? (
                      <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                        <p className="text-sm font-medium">Registration Options</p>
                        <input
                          type="hidden"
                          name="participant_contact_ids"
                          value={customerContact.id}
                        />

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Lunch Preference</label>
                          <select
                            name={`participant_${customerContact.id}_lunch_option_id`}
                            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                            defaultValue=""
                          >
                            <option value="">No lunch selected</option>
                            {lunchOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.name} — {formatMoney(option.price)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                            <input
                              type="checkbox"
                              name={`participant_${customerContact.id}_before_care`}
                            />
                            Before care
                          </label>

                          <label className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                            <input
                              type="checkbox"
                              name={`participant_${customerContact.id}_after_care`}
                            />
                            After care
                          </label>
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Notes{" "}
                        <span className="font-normal text-muted-foreground">
                          (Optional)
                        </span>
                      </label>
                      <textarea
                        name="notes"
                        rows={4}
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                        placeholder="Allergies, pickup notes, or anything else we should know."
                      />
                    </div>

                    <ProgramRegisterSessionFields sessions={sessions} />

                    {mode !== "waitlist" ? (
                      <ProgramRegisterQuotePreview
                        organizationId={organizationId}
                        programId={program.id}
                        offeringId={offering.id}
                        formId="program-register-form"
                      />
                    ) : null}

                    <Button type="submit" className="w-full">
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      {mode === "waitlist" ? "Join Waitlist" : "Submit Registration"}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{program.name}</CardTitle>
                <CardDescription>
                  {offering.name} · {program.description || "No description provided."}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5 text-sm">
                <div className="flex items-start gap-3 text-muted-foreground">
                  <CalendarDays className="mt-0.5 h-4 w-4" />
                  <span>
                    {formatDate(offering.start_date ?? program.start_date)} –{" "}
                    {formatDate(offering.end_date ?? program.end_date)}
                  </span>
                </div>

                <div className="rounded-lg border bg-blue-50 px-3 py-3 text-blue-900">
                  <div className="flex items-start gap-3">
                    <Clock className="mt-0.5 h-4 w-4" />
                    <div>
                      <p className="font-medium">Enrollment Window</p>
                      <p className="text-xs">
                        {formatDate(
                          offering.enrollment_open_date ?? program.enrollment_open_date
                        )}{" "}
                        –{" "}
                        {formatDate(
                          offering.enrollment_close_date ??
                            program.enrollment_close_date
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 text-muted-foreground">
                  <Users className="mt-0.5 h-4 w-4" />
                  <div>
                    <p className="font-medium text-foreground">Capacity</p>
                    <p>
                      {remainingSeats} seat{remainingSeats === 1 ? "" : "s"} remaining
                    </p>
                  </div>
                </div>

                {lunchOptions.length > 0 ? (
                  <div className="flex items-start gap-3 text-muted-foreground">
                    <Utensils className="mt-0.5 h-4 w-4" />
                    <div>
                      <p className="font-medium text-foreground">Lunch Options</p>
                      <p>{lunchOptions.length} available</p>
                    </div>
                  </div>
                ) : null}

                <div className="flex items-start gap-3 text-muted-foreground">
                  <UserRound className="mt-0.5 h-4 w-4" />
                  <div>
                    <p className="font-medium text-foreground">Ages</p>
                    <p>{ageRangeLabel}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 text-muted-foreground">
                  <GraduationCap className="mt-0.5 h-4 w-4" />
                  <div>
                    <p className="font-medium text-foreground">Grade Levels</p>
                    <p>{gradeRangeLabel}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 text-muted-foreground">
                  <UserCircle2 className="mt-0.5 h-4 w-4" />
                  <div>
                    <p className="font-medium text-foreground">Gender</p>
                    <p>{formatProgramGenderLabel(program.gender)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
