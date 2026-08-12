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
  UserCircle2,
  UserRound,
  Users,
} from "lucide-react"

import { createClient } from "@/lib/supabase/server"
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
import {
  formatProgramAgeRangeShort,
  formatProgramGenderLabel,
  formatProgramGradeRangeShort,
} from "@/lib/programs/program-eligibility-display"
import { getCustomerOfferingsForProgram } from "@/lib/programs/program-offering-queries"
import {
  formatOfferingDateRange,
  isOfferingEnrollmentOpen,
} from "@/lib/programs/program-offering-display"
import { isOfferingOpenEnrollment } from "@/lib/programs/offering-enrollment-path"
import type { ProgramOffering } from "@/lib/programs/program-offering-types"

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
  min_age: number | null
  max_age: number | null
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
      min_age,
      max_age,
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
  const offerings = await getCustomerOfferingsForProgram(
    program.id,
    organization.organization_id
  )
  const scheduleItems = await getProgramScheduleItems(program.id)

  const enrollmentLabel = getEnrollmentLabel(program)
  const remainingSeats = seatsRemaining(program)
  const ageRangeLabel = formatProgramAgeRangeShort(program)
  const gradeRangeLabel = formatProgramGradeRangeShort(program.grade_levels)
  const openOfferings = offerings.filter((offering) =>
    isOfferingEnrollmentOpen(offering, program)
  )
  const singleOffering =
    offerings.length === 1 ? offerings[0] : null

  function getOfferingCtaLabel(offering: ProgramOffering) {
    if (offering.status === "closed") {
      return "Registration closed"
    }

    if (!isOfferingEnrollmentOpen(offering, program)) {
      return "Not open yet"
    }

    return isOfferingOpenEnrollment(offering) ? "Register" : "Apply"
  }

  function isOfferingApplyDisabled(offering: ProgramOffering) {
    return (
      offering.status === "closed" ||
      !isOfferingEnrollmentOpen(offering, program)
    )
  }

  function offeringCtaHref(offering: ProgramOffering) {
    const base = isOfferingOpenEnrollment(offering)
      ? `/customer/programs/${program.id}/register`
      : `/customer/programs/${program.id}/apply`
    return `${base}?offering=${offering.id}`
  }

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
              disabled={
                offerings.length > 1 ||
                (offerings.length === 0 &&
                  (enrollmentLabel === "Closed" || enrollmentLabel === "Full")) ||
                (singleOffering
                  ? isOfferingApplyDisabled(singleOffering)
                  : false)
              }
              asChild={
                offerings.length <= 1 &&
                !(
                  offerings.length === 0 &&
                  (enrollmentLabel === "Closed" || enrollmentLabel === "Full")
                ) &&
                !(singleOffering && isOfferingApplyDisabled(singleOffering))
              }
            >
              {offerings.length > 1 ? (
                <span>Choose an offering below</span>
              ) : offerings.length === 0 ? (
                enrollmentLabel === "Closed" || enrollmentLabel === "Full" ? (
                  <span>
                    {enrollmentLabel === "Closed"
                      ? "Enrollment Closed"
                      : "Program Full"}
                  </span>
                ) : (
                  <Link href={`/customer/programs/${program.id}/apply`}>
                    Apply
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                )
              ) : singleOffering ? (
                isOfferingApplyDisabled(singleOffering) ? (
                  <span>{getOfferingCtaLabel(singleOffering)}</span>
                ) : (
                  <Link href={offeringCtaHref(singleOffering)}>
                    {getOfferingCtaLabel(singleOffering)}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                )
              ) : null}
            </Button>
          </div>
        </div>

        {offerings.length > 0 ? (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>
                {offerings.length === 1 ? "Program" : "Choose a program"}
              </CardTitle>
              <CardDescription>
                {offerings.length === 1
                  ? isOfferingOpenEnrollment(offerings[0])
                    ? "Register and pay for this program."
                    : "Apply for the available offering under this program."
                  : "Select the level, camp, or track you want."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {offerings.map((offering) => {
                  const disabled = isOfferingApplyDisabled(offering)

                  return (
                    <Card key={offering.id} className="shadow-none">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-lg">{offering.name}</CardTitle>
                          <Badge variant={disabled ? "secondary" : "default"}>
                            {disabled
                              ? getOfferingCtaLabel(offering)
                              : "Open"}
                          </Badge>
                        </div>
                        <CardDescription>
                          {formatOfferingDateRange(
                            offering.start_date,
                            offering.end_date
                          )}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button
                          className="w-full"
                          disabled={disabled}
                          asChild={!disabled}
                        >
                          {disabled ? (
                            <span>{getOfferingCtaLabel(offering)}</span>
                          ) : (
                            <Link href={offeringCtaHref(offering)}>
                              {getOfferingCtaLabel(offering)}
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
              {openOfferings.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  No programs are open for applications right now.
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                <UserCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gender</p>
                <p className="font-semibold">
                  {formatProgramGenderLabel(program.gender)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-lg bg-rose-100 p-3 text-rose-600">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ages</p>
                <p className="font-semibold">{ageRangeLabel}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-lg bg-indigo-100 p-3 text-indigo-600">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Grade Levels</p>
                <p className="font-semibold">{gradeRangeLabel}</p>
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
