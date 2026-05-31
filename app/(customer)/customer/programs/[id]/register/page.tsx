import Link from "next/link"
import { cookies } from "next/headers"
import { redirect, notFound } from "next/navigation"
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
  Info,
  Utensils,
  Users,
} from "lucide-react"

import { createClient } from "@/lib/supabase/server"
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
  start_date: string | null
  end_date: string | null
  enrollment_open_date: string | null
  enrollment_close_date: string | null
  age_groups: string[] | null
  grade_levels: string[] | null
  gender: string | null
  capacity: number
  enrolled: number
  waitlist: number
  status: string
}

type ProgramSession = {
  id: string
  organization_id: string
  program_id: string
  name: string
  description: string | null
  start_date: string | null
  end_date: string | null
  capacity: number | null
  enrolled: number | null
  waitlist: number | null
  price: number | null
  status: string | null
  sort_order: number | null
}

type LunchOption = {
  id: string
  organization_id: string
  name: string
  description: string | null
  price: number | null
  is_active: boolean
  sort_order: number | null
}

type CustomerContact = {
  id: string
  organization_id: string
  person_id: string | null
  full_name: string | null
  email: string | null
  phone: string | null
}

type FamilyRelationship = {
  related_person_id: string
  relationship_type: string
}

type Person = {
  id: string
  first_name: string | null
  last_name: string | null
  date_of_birth: string | null
  gender: string | null
  person_type: string | null
}

type FamilyMember = {
  id: string
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

function todayDateOnly() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function dateOnly(value?: string | null) {
  if (!value) return null
  return new Date(`${value}T00:00:00`)
}

function isEnrollmentOpen(open?: string | null, close?: string | null) {
  const today = todayDateOnly()

  const openDate = dateOnly(open)
  const closeDate = dateOnly(close)

  if (!openDate && !closeDate) return false
  if (openDate && today < openDate) return false
  if (closeDate && today > closeDate) return false

  return true
}

function seatsRemaining(program: Program) {
  return Math.max((program.capacity || 0) - (program.enrolled || 0), 0)
}

function sessionSeatsRemaining(session: ProgramSession) {
  return Math.max((session.capacity || 0) - (session.enrolled || 0), 0)
}

function isFull(program: Program) {
  return program.capacity > 0 && program.enrolled >= program.capacity
}

function getRegistrationMode(program: Program) {
  const enrollmentOpen = isEnrollmentOpen(
    program.enrollment_open_date,
    program.enrollment_close_date
  )

  if (!enrollmentOpen) return "closed"
  if (isFull(program)) return program.waitlist > 0 ? "waitlist" : "full"
  return "enroll"
}

function calculateAge(dateOfBirth?: string | null) {
  if (!dateOfBirth) return null

  const today = new Date()
  const birthDate = new Date(`${dateOfBirth}T00:00:00`)

  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--
  }

  return age
}

function formatRelationship(value: string) {
  const labels: Record<string, string> = {
    child: "Child / Grandchild",
    guardian: "Guardian",
    spouse: "Spouse",
    parent: "Parent",
    sibling: "Sibling",
    other: "Other",
  }

  return labels[value] || value
}

function getFullName(person: Pick<FamilyMember, "first_name" | "last_name">) {
  return `${person.first_name || ""} ${person.last_name || ""}`.trim()
}

async function getActiveCustomerOrganization() {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const activeOrganizationId = cookieStore.get("active_organization_id")?.value

  const { data: organizations, error } = await supabase.rpc(
    "get_my_organizations"
  )

  if (error) {
    return {
      organization: null,
      errorMessage: error.message,
    }
  }

  const customerOrganizations = (organizations || []) as CustomerOrganization[]

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
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data, error } = await supabase
    .from("contacts")
    .select("id, organization_id, person_id, full_name, email, phone")
    .eq("auth_user_id", user.id)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error) {
    console.error("Customer contact load error:", error)
    return null
  }

  return data as CustomerContact | null
}

async function getFamilyMembers(parentPersonId: string, organizationId: string) {
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

  const relationshipRows = (relationships || []) as FamilyRelationship[]
  const personIds = relationshipRows.map((row) => row.related_person_id)

  if (personIds.length === 0) return []

  const { data: people, error: peopleError } = await supabase
    .from("people")
    .select("id, first_name, last_name, date_of_birth, gender, person_type")
    .eq("organization_id", organizationId)
    .in("id", personIds)

  if (peopleError) {
    console.error("Family people load error:", peopleError)
    return []
  }

  const peopleRows = (people || []) as Person[]

  return relationshipRows
    .map((relationship) => {
      const person = peopleRows.find(
        (row) => row.id === relationship.related_person_id
      )

      if (!person) return null

      return {
        id: person.id,
        first_name: person.first_name || "",
        last_name: person.last_name || "",
        date_of_birth: person.date_of_birth,
        gender: person.gender,
        relationship_type: relationship.relationship_type,
      }
    })
    .filter(Boolean) as FamilyMember[]
}

async function registerForProgram(formData: FormData) {
  "use server"

  const supabase = await createClient()

  const programId = String(formData.get("program_id") || "")
  const organizationId = String(formData.get("organization_id") || "")
  const departmentId = String(formData.get("department_id") || "") || null
  const mode = String(formData.get("mode") || "")

  const childPersonId = String(formData.get("child_person_id") || "").trim()
  const parentName = String(formData.get("parent_name") || "").trim()
  const parentEmail = String(formData.get("parent_email") || "").trim()
  const parentPhone = String(formData.get("parent_phone") || "").trim()
  const notes = String(formData.get("notes") || "").trim()

  const selectedSessionIds = formData
    .getAll("session_ids")
    .map((sessionId) => String(sessionId))
    .filter(Boolean)

  const beforeCare = formData.get("before_care") === "on"
  const afterCare = formData.get("after_care") === "on"
  const lunchOptionId =
    String(formData.get("lunch_option_id") || "").trim() || null

  if (!programId || !organizationId || !childPersonId) {
    redirect(`/customer/programs/${programId}/register?error=missing-fields`)
  }

  const { data: childPerson, error: childError } = await supabase
    .from("people")
    .select("id, first_name, last_name, date_of_birth")
    .eq("id", childPersonId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (childError || !childPerson) {
    redirect(`/customer/programs/${programId}/register?error=invalid-participant`)
  }

  const childName = `${childPerson.first_name || ""} ${
    childPerson.last_name || ""
  }`.trim()
  const childAge = calculateAge(childPerson.date_of_birth)

  if (!childName) {
    redirect(`/customer/programs/${programId}/register?error=invalid-participant`)
  }

  const { data: program, error: programError } = await supabase
    .from("programs")
    .select(
      `
      id,
      organization_id,
      department_id,
      capacity,
      enrolled,
      waitlist,
      status,
      enrollment_open_date,
      enrollment_close_date
    `
    )
    .eq("id", programId)
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .maybeSingle()

  if (programError || !program) {
    redirect("/customer/programs")
  }

  const currentMode = getRegistrationMode(program as Program)

  if (currentMode === "closed" || currentMode === "full") {
    redirect(`/customer/programs/${programId}?registration=unavailable`)
  }

  let lunchType: string | null = null
  let lunchPrice = 0

  if (lunchOptionId) {
    const { data: lunchOption, error: lunchError } = await supabase
      .from("program_lunch_options")
      .select("id, name, price")
      .eq("id", lunchOptionId)
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .maybeSingle()

    if (lunchError || !lunchOption) {
      redirect(`/customer/programs/${programId}/register?error=invalid-lunch`)
    }

    lunchType = lunchOption.name
    lunchPrice = Number(lunchOption.price || 0)
  }

  const selectedSessions: ProgramSession[] = []

  if (selectedSessionIds.length > 0) {
    const { data: sessions, error: sessionsError } = await supabase
      .from("program_sessions")
      .select(
        "id, organization_id, program_id, name, description, start_date, end_date, capacity, enrolled, waitlist, price, status, sort_order"
      )
      .eq("organization_id", organizationId)
      .eq("program_id", programId)
      .in("id", selectedSessionIds)

    if (sessionsError) {
      redirect(`/customer/programs/${programId}/register?error=invalid-session`)
    }

    selectedSessions.push(...((sessions || []) as ProgramSession[]))

    if (selectedSessions.length !== selectedSessionIds.length) {
      redirect(`/customer/programs/${programId}/register?error=invalid-session`)
    }
  }

  const sessionTotal = selectedSessions.reduce((total, session) => {
    return total + Number(session.price || 0)
  }, 0)

  const totalAmount = sessionTotal + lunchPrice
  const today = new Date().toISOString().slice(0, 10)

  if (currentMode === "waitlist" || mode === "waitlist") {
    const { data: existingWaitlistRegistration } = await supabase
      .from("program_waitlist")
      .select("id")
      .eq("program_id", programId)
      .eq("child_person_id", childPersonId)
      .maybeSingle()

    if (existingWaitlistRegistration) {
      redirect(`/customer/programs/${programId}/register?error=already-waitlisted`)
    }

    const { data: existingWaitlist } = await supabase
      .from("program_waitlist")
      .select("position")
      .eq("program_id", programId)
      .order("position", { ascending: false })
      .limit(1)

    const nextPosition = (existingWaitlist?.[0]?.position || 0) + 1

    const { error } = await supabase.from("program_waitlist").insert({
      organization_id: organizationId,
      program_id: programId,
      child_person_id: childPersonId,
      child_name: childName,
      child_age: childAge,
      parent_name: parentName || null,
      parent_email: parentEmail || null,
      parent_phone: parentPhone || null,
      preferred_weeks:
        selectedSessionIds.length > 0 ? selectedSessionIds : null,
      added_date: today,
      position: nextPosition,
      status: "waiting",
      priority: "normal",
      notes: notes || null,
    })

    if (error) {
      if (error.code === "23505") {
        redirect(`/customer/programs/${programId}/register?error=already-waitlisted`)
      }

      throw new Error(error.message)
    }

    await supabase
      .from("programs")
      .update({ waitlist: (program.waitlist || 0) + 1 })
      .eq("id", programId)

    redirect(`/customer/programs/${programId}?registration=waitlist-success`)
  }

  const { data: existingEnrollment } = await supabase
    .from("program_enrollments")
    .select("id")
    .eq("program_id", programId)
    .eq("child_person_id", childPersonId)
    .maybeSingle()

  if (existingEnrollment) {
    redirect(`/customer/programs/${programId}/register?error=already-enrolled`)
  }

  const { error } = await supabase.from("program_enrollments").insert({
    organization_id: organizationId,
    program_id: programId,
    department_id: departmentId,
    child_person_id: childPersonId,
    child_name: childName,
    child_age: childAge,
    parent_name: parentName || null,
    parent_email: parentEmail || null,
    parent_phone: parentPhone || null,
    session_name:
      selectedSessions.length === 1 ? selectedSessions[0].name : null,
    weeks: selectedSessionIds.length > 0 ? selectedSessionIds : null,
    enrollment_date: today,
    status: "pending",
    payment_status: "pending",
    amount_paid: 0,
    total_amount: totalAmount,
    before_care: beforeCare,
    after_care: afterCare,
    lunch_type: lunchType,
    notes: notes || null,
  })

  if (error) {
    if (error.code === "23505") {
      redirect(`/customer/programs/${programId}/register?error=already-enrolled`)
    }

    throw new Error(error.message)
  }

  await supabase
    .from("programs")
    .update({ enrolled: (program.enrolled || 0) + 1 })
    .eq("id", programId)

  redirect(`/customer/programs/${programId}?registration=success`)
}

export default async function CustomerProgramRegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ error?: string }>
}) {
  const { id } = await params
  const resolvedSearchParams = await searchParams
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

  const customerContact = await getCurrentCustomerContact(
    organization.organization_id
  )

  const familyMembers = customerContact?.person_id
    ? await getFamilyMembers(
        customerContact.person_id,
        organization.organization_id
      )
    : []

  const { data, error } = await supabase
    .from("programs")
    .select(
      `
      id,
      organization_id,
      name,
      description,
      department_id,
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
    .eq("id", id)
    .eq("organization_id", organization.organization_id)
    .eq("status", "active")
    .maybeSingle()

  if (error || !data) {
    notFound()
  }

  const program = data as Program

  const { data: sessionData } = await supabase
    .from("program_sessions")
    .select(
      "id, organization_id, program_id, name, description, start_date, end_date, capacity, enrolled, waitlist, price, status, sort_order"
    )
    .eq("organization_id", organization.organization_id)
    .eq("program_id", program.id)
    .eq("status", "active")
    .order("sort_order", { ascending: true })
    .order("start_date", { ascending: true })

  const sessions = (sessionData || []) as ProgramSession[]

  const { data: lunchData } = await supabase
    .from("program_lunch_options")
    .select(
      "id, organization_id, name, description, price, is_active, sort_order"
    )
    .eq("organization_id", organization.organization_id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  const lunchOptions = (lunchData || []) as LunchOption[]

  const mode = getRegistrationMode(program)
  const remainingSeats = seatsRemaining(program)

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
                <Link href={`/customer/programs/${program.id}`}>
                  View Program
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const errorMessages: Record<string, string> = {
    "missing-fields": "Please select a participant before continuing.",
    "invalid-participant": "The selected participant could not be found.",
    "invalid-session": "One of the selected sessions could not be found.",
    "invalid-lunch": "The selected lunch option could not be found.",
    "already-enrolled": "This participant is already enrolled in this program.",
    "already-waitlisted":
      "This participant is already on the waitlist for this program.",
    "save-failed": "We could not save this registration. Please try again.",
  }

  const ageGroups = program.age_groups || []
  const gradeLevels = program.grade_levels || []

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
                      ? "Join Waitlist"
                      : "Register for Program"}
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
                  Complete the form below for {program.name}.
                </CardDescription>
              </CardHeader>

              <CardContent>
                {resolvedSearchParams?.error ? (
                  <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errorMessages[resolvedSearchParams.error] ||
                      "Something went wrong. Please try again."}
                  </div>
                ) : null}

                {!customerContact?.person_id ? (
                  <div className="rounded-lg border border-dashed p-8 text-center">
                    <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                    <h3 className="font-medium">Profile connection needed</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Your customer profile is not linked to a person record yet.
                    </p>
                    <Button className="mt-4" asChild>
                      <Link href="/customer/profile">Go to Profile</Link>
                    </Button>
                  </div>
                ) : familyMembers.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center">
                    <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                    <h3 className="font-medium">No family members found</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Add a child or grandchild to your profile before registering.
                    </p>
                    <Button className="mt-4" asChild>
                      <Link href="/customer/profile">Add Family Member</Link>
                    </Button>
                  </div>
                ) : (
                  <form action={registerForProgram} className="space-y-6">
                    <input type="hidden" name="program_id" value={program.id} />
                    <input
                      type="hidden"
                      name="organization_id"
                      value={organization.organization_id}
                    />
                    <input
                      type="hidden"
                      name="department_id"
                      value={program.department_id || ""}
                    />
                    <input type="hidden" name="mode" value={mode} />

                    <div className="space-y-3">
                      <label className="text-sm font-medium">
                        Select Participant <span className="text-red-500">*</span>
                      </label>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {familyMembers.map((member) => {
                          const fullName = getFullName(member)
                          const age = calculateAge(member.date_of_birth)

                          return (
                            <label
                              key={member.id}
                              className="flex cursor-pointer items-start gap-3 rounded-lg border bg-background px-4 py-3 text-sm hover:bg-muted"
                            >
                              <input
                                type="radio"
                                name="child_person_id"
                                value={member.id}
                                required
                                className="mt-1"
                              />
                              <div>
                                <p className="font-medium">{fullName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatRelationship(member.relationship_type)}
                                  {age !== null ? ` · Age ${age}` : ""}
                                  {member.gender ? ` · ${member.gender}` : ""}
                                </p>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Parent / Guardian Name
                        </label>
                        <input
                          name="parent_name"
                          defaultValue={customerContact?.full_name || ""}
                          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Parent / Guardian Email
                        </label>
                        <input
                          name="parent_email"
                          type="email"
                          defaultValue={customerContact?.email || ""}
                          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        />
                      </div>

                      <div className="space-y-2 sm:col-span-2">
                        <label className="text-sm font-medium">
                          Parent / Guardian Phone
                        </label>
                        <input
                          name="parent_phone"
                          defaultValue={customerContact?.phone || ""}
                          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        />
                      </div>
                    </div>

                    {mode !== "waitlist" ? (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Lunch Preference
                        </label>
                        <select
                          name="lunch_option_id"
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
                    ) : null}

                    {mode !== "waitlist" ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                          <input type="checkbox" name="before_care" />
                          Before care
                        </label>

                        <label className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                          <input type="checkbox" name="after_care" />
                          After care
                        </label>
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Notes <span className="font-normal text-muted-foreground">(Optional)</span>
                      </label>
                      <textarea
                        name="notes"
                        rows={4}
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                        placeholder="Allergies, pickup notes, or anything else we should know."
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <label className="text-sm font-medium">Sessions</label>
                          <p className="text-xs text-muted-foreground">
                            Select the sessions you want to register for.
                          </p>
                        </div>
                      </div>

                      {sessions.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                          No sessions are available for this program yet.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {sessions.map((session) => {
                            const remaining = sessionSeatsRemaining(session)

                            return (
                              <label
                                key={session.id}
                                className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border bg-background px-4 py-3 text-sm hover:bg-muted"
                              >
                                <span className="flex items-start gap-3">
                                  <input
                                    type="checkbox"
                                    name="session_ids"
                                    value={session.id}
                                    className="mt-1"
                                  />
                                  <span>
                                    <span className="font-medium">
                                      {session.name}
                                    </span>
                                    <span className="block text-xs text-muted-foreground">
                                      {formatDate(session.start_date)} –{" "}
                                      {formatDate(session.end_date)}
                                    </span>
                                  </span>
                                </span>

                                <span className="text-right text-xs text-muted-foreground">
                                  <span className="block">
                                    {formatMoney(session.price)}
                                  </span>
                                  <span className="block text-emerald-700">
                                    {remaining} seat
                                    {remaining === 1 ? "" : "s"} available
                                  </span>
                                </span>
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    <Button type="submit" className="w-full">
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      {mode === "waitlist"
                        ? "Join Waitlist"
                        : "Submit Registration"}
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
                  {program.description || "No description provided."}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5 text-sm">
                <div className="flex items-start gap-3 text-muted-foreground">
                  <CalendarDays className="mt-0.5 h-4 w-4" />
                  <span>
                    {formatDate(program.start_date)} –{" "}
                    {formatDate(program.end_date)}
                  </span>
                </div>

                <div className="rounded-lg border bg-blue-50 px-3 py-3 text-blue-900">
                  <div className="flex items-start gap-3">
                    <Clock className="mt-0.5 h-4 w-4" />
                    <div>
                      <p className="font-medium">Enrollment Window</p>
                      <p className="text-xs">
                        {formatDate(program.enrollment_open_date)} –{" "}
                        {formatDate(program.enrollment_close_date)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 text-muted-foreground">
                  <Users className="mt-0.5 h-4 w-4" />
                  <div>
                    <p className="font-medium text-foreground">Capacity</p>
                    <p>
                      {remainingSeats} seat{remainingSeats === 1 ? "" : "s"}{" "}
                      remaining
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

                <div className="border-t pt-5">
                  <p className="mb-3 text-base font-semibold">Eligibility</p>

                  <div className="space-y-4">
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        Age Groups
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {ageGroups.length > 0 ? (
                          ageGroups.map((age) => (
                            <Badge key={age} variant="secondary">
                              {age}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="secondary">All ages</Badge>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        Grade Levels
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {gradeLevels.length > 0 ? (
                          gradeLevels.map((grade) => (
                            <Badge key={grade} variant="outline">
                              {grade}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="outline">All grades</Badge>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        Gender
                      </p>
                      <Badge variant="secondary">
                        {program.gender || "All genders"}
                      </Badge>
                    </div>

                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900">
                      <div className="flex gap-2">
                        <Info className="h-4 w-4 shrink-0" />
                        <p>
                          Eligibility rules are set by the organization.
                        </p>
                      </div>
                    </div>
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