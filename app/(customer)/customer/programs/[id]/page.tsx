import Link from "next/link"
import { cookies } from "next/headers"
import { notFound } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clock,
  GraduationCap,
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
import { cn } from "@/lib/utils"

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

type ScheduleItem = {
  id: string
  program_id: string
  day_of_week: string | null
  title: string | null
  description: string | null
  start_time: string | null
  end_time: string | null
  sort_order: number | null
}

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]

function formatDate(date?: string | null) {
  if (!date) return "Not set"

  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatTime(time?: string | null) {
  if (!time) return "Time not set"

  const [hours, minutes] = time.split(":")
  const date = new Date()
  date.setHours(Number(hours || 0))
  date.setMinutes(Number(minutes || 0))

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
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

  if (!openDate && !closeDate) return true
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

function getEnrollmentLabel(program: Program) {
  const enrollmentOpen = isEnrollmentOpen(
    program.enrollment_open_date,
    program.enrollment_close_date
  )

  if (!enrollmentOpen) return "Closed"
  if (isFull(program)) return program.waitlist > 0 ? "Waitlist" : "Full"
  return "Open"
}

function getEnrollmentBadgeClass(program: Program) {
  const label = getEnrollmentLabel(program)

  if (label === "Open") return "bg-emerald-600 hover:bg-emerald-600"
  if (label === "Waitlist") return "bg-amber-600 hover:bg-amber-600"
  if (label === "Full") return "bg-red-600 hover:bg-red-600"

  return ""
}

function getEnrollmentPercent(program: Program) {
  if (!program.capacity || program.capacity <= 0) return 0
  return Math.min(Math.round((program.enrolled / program.capacity) * 100), 100)
}

function getEnrollmentBarColor(program: Program) {
  const percent = getEnrollmentPercent(program)

  if (percent >= 90) return "bg-red-500"
  if (percent >= 70) return "bg-amber-500"

  return "bg-emerald-500"
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

async function getProgramScheduleItems(programId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("program_schedule_items")
    .select(
      `
      id,
      program_id,
      day_of_week,
      title,
      description,
      start_time,
      end_time,
      sort_order
    `
    )
    .eq("program_id", programId)
    .order("sort_order", { ascending: true })

  if (error) {
    return []
  }

  return (data || []) as ScheduleItem[]
}

export default async function CustomerProgramDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { organization, errorMessage } = await getActiveCustomerOrganization()

  if (errorMessage || !organization) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] px-6 py-8">
        <div className="mx-auto max-w-5xl">
          <Card className="shadow-sm">
            <CardContent className="flex min-h-[260px] flex-col items-center justify-center p-8 text-center">
              <BookOpen className="mb-4 h-10 w-10 text-muted-foreground" />
              <h1 className="text-lg font-semibold">Unable to load program</h1>
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
  const scheduleItems = await getProgramScheduleItems(program.id)

  const enrollmentLabel = getEnrollmentLabel(program)
  const remainingSeats = seatsRemaining(program)
  const enrollmentPercent = getEnrollmentPercent(program)

  return (
    <div className="min-h-screen bg-[#f5f5f7] px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div>
          <Link
            href="/customer/programs"
            className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Programs
          </Link>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">
                  {program.name}
                </h1>
                <Badge
                  variant={enrollmentLabel === "Closed" ? "secondary" : "default"}
                  className={getEnrollmentBadgeClass(program)}
                >
                  {enrollmentLabel}
                </Badge>
              </div>

              <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
                {program.description || "No description provided."}
              </p>

              <p className="mt-2 text-xs text-muted-foreground">
                Offered by {organization.organization_name}
              </p>
            </div>

            <Button
              size="lg"
              disabled={enrollmentLabel === "Closed" || enrollmentLabel === "Full"}
              asChild={
                enrollmentLabel !== "Closed" && enrollmentLabel !== "Full"
              }
            >
              {enrollmentLabel === "Closed" || enrollmentLabel === "Full" ? (
                <span>
                  {enrollmentLabel === "Closed"
                    ? "Enrollment Closed"
                    : "Program Full"}
                </span>
              ) : (
                <Link href={`/customer/programs/${program.id}/register`}>
                  {enrollmentLabel === "Waitlist"
                    ? "Join Waitlist"
                    : "Register"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              )}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-lg bg-blue-100 p-3 text-blue-600">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Program Dates</p>
                <p className="font-semibold">
                  {formatDate(program.start_date)} – {formatDate(program.end_date)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-lg bg-emerald-100 p-3 text-emerald-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Enrollment</p>
                <p className="font-semibold">
                  {formatDate(program.enrollment_open_date)} –{" "}
                  {formatDate(program.enrollment_close_date)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-lg bg-purple-100 p-3 text-purple-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Seats Remaining</p>
                <p className="font-semibold">{remainingSeats}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-lg bg-orange-100 p-3 text-orange-600">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gender</p>
                <p className="font-semibold">{program.gender || "All genders"}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="shadow-sm lg:col-span-2">
            <CardHeader>
              <CardTitle>Program Details</CardTitle>
              <CardDescription>
                Review dates, eligibility, and enrollment availability.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">Enrollment</span>
                  <span className="font-medium">
                    {program.enrolled}/{program.capacity}
                    {program.waitlist > 0
                      ? ` (+${program.waitlist} waitlist)`
                      : ""}
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      getEnrollmentBarColor(program)
                    )}
                    style={{ width: `${enrollmentPercent}%` }}
                  />
                </div>

                <p className="mt-2 text-sm text-muted-foreground">
                  {remainingSeats > 0
                    ? `${remainingSeats} seat${
                        remainingSeats === 1 ? "" : "s"
                      } remaining.`
                    : program.waitlist > 0
                      ? "This program is full. Waitlist may be available."
                      : "This program is full."}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Start Date</p>
                  <p className="font-medium">{formatDate(program.start_date)}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">End Date</p>
                  <p className="font-medium">{formatDate(program.end_date)}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">
                    Enrollment Opens
                  </p>
                  <p className="font-medium">
                    {formatDate(program.enrollment_open_date)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">
                    Enrollment Closes
                  </p>
                  <p className="font-medium">
                    {formatDate(program.enrollment_close_date)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Eligibility</CardTitle>
              <CardDescription>
                Who this program is intended for.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <div>
                <p className="mb-2 text-sm font-medium">Age Groups</p>
                {program.age_groups.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {program.age_groups.map((ageGroup) => (
                      <Badge key={ageGroup} variant="secondary">
                        {ageGroup}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">All ages</p>
                )}
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Grade Levels</p>
                {program.grade_levels.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {program.grade_levels.map((gradeLevel) => (
                      <Badge key={gradeLevel} variant="secondary">
                        {gradeLevel}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">All grades</p>
                )}
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Gender</p>
                <Badge variant="secondary">
                  {program.gender || "All genders"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
            <CardDescription>
              Weekly activities and session times for this program.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {scheduleItems.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <CalendarDays className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                <h3 className="font-medium">No schedule available yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Schedule details will appear here when they are added.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-7">
                {DAYS.map((day) => {
                  const items = scheduleItems.filter(
                    (item) => item.day_of_week === day
                  )

                  return (
                    <Card key={day} className="min-h-[220px] shadow-none">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm capitalize">
                          {day}
                        </CardTitle>
                      </CardHeader>

                      <CardContent className="space-y-2">
                        {items.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            No activities
                          </p>
                        ) : (
                          items.map((item) => (
                            <div
                              key={item.id}
                              className="rounded-lg border bg-background p-3"
                            >
                              <p className="text-sm font-medium">
                                {item.title || "Activity"}
                              </p>

                              <p className="mt-1 text-xs text-muted-foreground">
                                {formatTime(item.start_time)} –{" "}
                                {formatTime(item.end_time)}
                              </p>

                              {item.description ? (
                                <p className="mt-2 text-xs text-muted-foreground">
                                  {item.description}
                                </p>
                              ) : null}
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
