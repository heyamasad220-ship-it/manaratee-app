import Link from "next/link"
import { cookies } from "next/headers"
import { redirect, notFound } from "next/navigation"
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
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
import { Input } from "@/components/ui/input"

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
  age_groups: string[]
  grade_levels: string[]
  gender: string | null
  capacity: number
  enrolled: number
  waitlist: number
  status: string
}

function formatDate(date?: string | null) {
  if (!date) return "Not set"

  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
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

async function registerForProgram(formData: FormData) {
  "use server"

  const supabase = await createClient()

  const programId = String(formData.get("program_id") || "")
  const organizationId = String(formData.get("organization_id") || "")
  const departmentId = String(formData.get("department_id") || "") || null
  const mode = String(formData.get("mode") || "")

  const childName = String(formData.get("child_name") || "").trim()
  const childAgeRaw = String(formData.get("child_age") || "").trim()
  const parentName = String(formData.get("parent_name") || "").trim()
  const parentEmail = String(formData.get("parent_email") || "").trim()
  const parentPhone = String(formData.get("parent_phone") || "").trim()
  const notes = String(formData.get("notes") || "").trim()

  const selectedWeeks = formData
    .getAll("weeks")
    .map((week) => String(week))
    .filter(Boolean)

  const beforeCare = formData.get("before_care") === "on"
  const afterCare = formData.get("after_care") === "on"
  const lunchType = String(formData.get("lunch_type") || "").trim() || null

  if (!programId || !organizationId || !childName) {
    redirect(`/customer/programs/${programId}/register?error=missing-fields`)
  }

  const childAge = childAgeRaw ? Number(childAgeRaw) : null

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

  const today = new Date().toISOString().slice(0, 10)

  if (currentMode === "waitlist" || mode === "waitlist") {
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
      child_name: childName,
      child_age: childAge,
      parent_name: parentName || null,
      parent_email: parentEmail || null,
      parent_phone: parentPhone || null,
      preferred_weeks: selectedWeeks.length > 0 ? selectedWeeks : null,
      added_date: today,
      position: nextPosition,
      status: "waiting",
      priority: "normal",
      notes: notes || null,
    })

    if (error) {
  throw new Error(error.message)
}

    await supabase
      .from("programs")
      .update({ waitlist: (program.waitlist || 0) + 1 })
      .eq("id", programId)

    redirect(`/customer/programs/${programId}?registration=waitlist-success`)
  }

  const { error } = await supabase.from("program_enrollments").insert({
    organization_id: organizationId,
    program_id: programId,
    department_id: departmentId,
    child_name: childName,
    child_age: childAge,
    parent_name: parentName || null,
    parent_email: parentEmail || null,
    parent_phone: parentPhone || null,
    session_name: null,
    weeks: selectedWeeks.length > 0 ? selectedWeeks : null,
    enrollment_date: today,
    status: "enrolled",
    payment_status: "pending",
    amount_paid: 0,
    total_amount: 0,
    before_care: beforeCare,
    after_care: afterCare,
    lunch_type: lunchType,
    notes: notes || null,
  })

 
    if (error) {
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

  return (
    <div className="min-h-screen bg-[#f5f5f7] px-6 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
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
                {resolvedSearchParams?.error === "missing-fields" ? (
                  <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    Please complete the required fields.
                  </div>
                ) : null}

                {resolvedSearchParams?.error === "save-failed" ? (
                  <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    We could not save this registration. Please try again.
                  </div>
                ) : null}

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

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Child Name <span className="text-red-500">*</span>
                      </label>
                      <Input name="child_name" required />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Child Age</label>
                      <Input name="child_age" type="number" min="0" />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Parent Name</label>
                      <Input name="parent_name" />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Parent Email</label>
                      <Input name="parent_email" type="email" />
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <label className="text-sm font-medium">Parent Phone</label>
                      <Input name="parent_phone" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium">
                      Preferred Weeks
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {["Week 1", "Week 2", "Week 3", "Week 4"].map((week) => (
                        <label
                          key={week}
                          className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm"
                        >
                          <input type="checkbox" name="weeks" value={week} />
                          {week}
                        </label>
                      ))}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      This uses your existing array field. Later we can replace
                      this with actual sessions/weeks if you add those tables.
                    </p>
                  </div>

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

                  {mode !== "waitlist" ? (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Lunch Type</label>
                      <select
                        name="lunch_type"
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        defaultValue=""
                      >
                        <option value="">No lunch selected</option>
                        <option value="bring-own">Bring own lunch</option>
                        <option value="standard">Standard lunch</option>
                        <option value="vegetarian">Vegetarian lunch</option>
                      </select>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Notes</label>
                    <textarea
                      name="notes"
                      rows={4}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      placeholder="Allergies, pickup notes, or anything else we should know."
                    />
                  </div>

                  <Button type="submit" className="w-full">
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {mode === "waitlist"
                      ? "Join Waitlist"
                      : "Submit Registration"}
                  </Button>
                </form>
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

              <CardContent className="space-y-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  <span>
                    {formatDate(program.start_date)} –{" "}
                    {formatDate(program.end_date)}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>
                    Enrollment: {formatDate(program.enrollment_open_date)} –{" "}
                    {formatDate(program.enrollment_close_date)}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>
                    {remainingSeats} seat{remainingSeats === 1 ? "" : "s"}{" "}
                    remaining
                  </span>
                </div>

                <div className="border-t pt-4">
                  <p className="mb-2 font-medium">Eligibility</p>

                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Age Groups
                      </p>
                      <p>
                        {program.age_groups.length > 0
                          ? program.age_groups.join(", ")
                          : "All ages"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">
                        Grade Levels
                      </p>
                      <p>
                        {program.grade_levels.length > 0
                          ? program.grade_levels.join(", ")
                          : "All grades"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Gender</p>
                      <p>{program.gender || "All genders"}</p>
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
