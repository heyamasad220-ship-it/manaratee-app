"use server"

import Link from "next/link"
import { cookies } from "next/headers"
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clock,
  GraduationCap,
  Search,
  Sparkles,
  Users,
} from "lucide-react"

import { getCustomerPortalSupabase } from "@/lib/auth/customer-portal-session"
import { getMyOrganizations } from "@/lib/organizations/get-my-organizations"
import { userHasActiveMembership } from "@/lib/memberships/membership-queries"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { formatProgramAgeEligibility } from "@/lib/programs/program-eligibility-display"

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
  visibility?: "public" | "private" | "members_only" | null
}

type SearchParams = {
  q?: string | string[]
  enrollment?: string | string[]
}

function getValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
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

  // no enrollment dates = open
  if (!openDate && !closeDate) return true

  // enrollment has not started yet
  if (openDate && today < openDate) return false

  // enrollment already ended
  if (closeDate && today > closeDate) return false

  return true
}

function isUpcoming(program: Program) {
  const startDate = dateOnly(program.start_date)
  if (!startDate) return false
  return startDate > todayDateOnly()
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

function matchesFilters(
  program: Program,
  filters: { q: string; enrollment: string }
) {
  const query = filters.q.trim().toLowerCase()
  const enrollment = filters.enrollment || "all"

  const matchesSearch =
    !query ||
    program.name.toLowerCase().includes(query) ||
    (program.description || "").toLowerCase().includes(query) ||
    (program.gender || "").toLowerCase().includes(query) ||
    program.age_groups.some((age) => age.toLowerCase().includes(query)) ||
    formatProgramAgeEligibility(program).toLowerCase().includes(query) ||
    program.grade_levels.some((grade) => grade.toLowerCase().includes(query))

  const enrollmentLabel = getEnrollmentLabel(program).toLowerCase()

  const matchesEnrollment =
    enrollment === "all" ||
    enrollmentLabel === enrollment ||
    (enrollment === "open" && enrollmentLabel === "open") ||
    (enrollment === "closed" && enrollmentLabel === "closed") ||
    (enrollment === "waitlist" && enrollmentLabel === "waitlist") ||
    (enrollment === "full" && enrollmentLabel === "full")

  return matchesSearch && matchesEnrollment
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

export default async function CustomerProgramsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>
}) {
  const resolvedSearchParams = await searchParams

  const filters = {
    q: getValue(resolvedSearchParams?.q) || "",
    enrollment: getValue(resolvedSearchParams?.enrollment) || "all",
  }

  const supabase = (await getCustomerPortalSupabase()).supabase

  const { organization, errorMessage: organizationError } =
    await getActiveCustomerOrganization()

  let programs: Program[] = []
  let errorMessage = organizationError

  if (organization) {
    const { session } = await getCustomerPortalSupabase()
    const userId = session.effectiveUserId

    const hasMembership = userId
      ? await userHasActiveMembership(organization.organization_id, userId)
      : false

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
        status,
        visibility
      `
      )
      .eq("organization_id", organization.organization_id)
      .eq("status", "active")
      .neq("visibility", "private")
      .order("start_date", { ascending: true })

    if (error) {
      errorMessage = error.message
    } else {
      programs = ((data || []) as Program[]).filter((program) => {
        if (program.visibility === "members_only") {
          return hasMembership
        }
        return true
      })
    }
  }

  const filteredPrograms = programs.filter((program) =>
    matchesFilters(program, filters)
  )

  const openPrograms = programs.filter((program) =>
    isEnrollmentOpen(program.enrollment_open_date, program.enrollment_close_date)
  ).length

  const upcomingPrograms = programs.filter(isUpcoming).length

  const totalSeatsRemaining = programs.reduce(
    (total, program) => total + seatsRemaining(program),
    0
  )

  return (
    <div className="min-h-screen bg-[#f5f5f7] px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Programs</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Explore available programs, classes, camps, and activities from{" "}
            {organization?.organization_name || "your organization"}.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-l-4 border-l-blue-600 shadow-sm">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">Active Years/Seasons</p>
                <p className="text-3xl font-bold">{programs.length}</p>
              </div>
              <div className="rounded-lg bg-blue-100 p-3 text-blue-600">
                <BookOpen className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500 shadow-sm">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">Enrollment Open</p>
                <p className="text-3xl font-bold text-emerald-600">
                  {openPrograms}
                </p>
              </div>
              <div className="rounded-lg bg-emerald-100 p-3 text-emerald-600">
                <Sparkles className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500 shadow-sm">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">
                  Upcoming Years/Seasons
                </p>
                <p className="text-3xl font-bold text-orange-600">
                  {upcomingPrograms}
                </p>
              </div>
              <div className="rounded-lg bg-orange-100 p-3 text-orange-600">
                <CalendarDays className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500 shadow-sm">
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">Seats Remaining</p>
                <p className="text-3xl font-bold text-purple-600">
                  {totalSeatsRemaining}
                </p>
              </div>
              <div className="rounded-lg bg-purple-100 p-3 text-purple-600">
                <Users className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <form className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative flex-1 lg:max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  name="q"
                  defaultValue={filters.q}
                  placeholder="Search programs..."
                  className="pl-9"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <select
                  name="enrollment"
                  defaultValue={filters.enrollment}
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="all">All Enrollment</option>
                  <option value="open">Open</option>
                  <option value="waitlist">Waitlist</option>
                  <option value="full">Full</option>
                  <option value="closed">Closed</option>
                </select>

                <Button type="submit">Filter</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div>
          <h2 className="text-lg font-bold">Available Years/Seasons</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Showing active programs only. Draft, paused, and archived programs
            are hidden from customers.
          </p>
        </div>

        {errorMessage ? (
          <Card className="shadow-sm">
            <CardContent className="flex min-h-[260px] flex-col items-center justify-center p-8 text-center">
              <BookOpen className="mb-4 h-10 w-10 text-muted-foreground" />
              <h3 className="font-semibold">Unable to load programs</h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                {errorMessage}
              </p>
            </CardContent>
          </Card>
        ) : filteredPrograms.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="flex min-h-[260px] flex-col items-center justify-center p-8 text-center">
              <BookOpen className="mb-4 h-10 w-10 text-muted-foreground" />
              <h3 className="font-semibold">No programs found</h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                No active programs match your current filters.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredPrograms.map((program) => {
              const enrollmentLabel = getEnrollmentLabel(program)
              const remainingSeats = seatsRemaining(program)
              const enrollmentPercent = getEnrollmentPercent(program)

              return (
                <Card
                  key={program.id}
                  className="shadow-sm transition hover:shadow-md"
                >
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold">{program.name}</h3>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {program.description || "No description provided."}
                        </p>
                      </div>

                      <Badge
                        variant={
                          enrollmentLabel === "Closed" ? "secondary" : "default"
                        }
                        className={getEnrollmentBadgeClass(program)}
                      >
                        {enrollmentLabel}
                      </Badge>
                    </div>

                    <div>
                      <div className="mb-2 flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Enrollment
                        </span>
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

                      <p className="mt-2 text-xs text-muted-foreground">
                        {remainingSeats > 0
                          ? `${remainingSeats} seat${
                              remainingSeats === 1 ? "" : "s"
                            } remaining`
                          : program.waitlist > 0
                            ? "Year/Season is full. Waitlist may be available."
                            : "Year/Season is full."}
                      </p>
                    </div>

                    <div className="space-y-2 border-t pt-4 text-sm">
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
                          Enrollment:{" "}
                          {formatDate(program.enrollment_open_date)} –{" "}
                          {formatDate(program.enrollment_close_date)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-muted-foreground">
                        <GraduationCap className="h-4 w-4" />
                        <span>
                          {program.grade_levels.length > 0
                            ? program.grade_levels.join(", ")
                            : "All grades"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>
                          {formatProgramAgeEligibility(program)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{program.gender || "All genders"}</span>
                      </div>
                    </div>

                    <Button asChild className="w-full">
                      <Link href={`/customer/programs/${program.id}`}>
                        View Year/Season
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
