import Link from "next/link"
import {
  Archive,
  Calendar,
  ImageIcon,
  Plus,
  Users,
} from "lucide-react"

import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { getDepartments } from "@/lib/departments/department-queries"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { getPrograms } from "@/lib/programs/program-queries"
import { getOfferingCountsByProgramIds } from "@/lib/programs/program-offering-queries"
import type { Program } from "@/lib/programs/program-types"
import type { ProgramStatus } from "@/lib/programs/program-status"
import { getProgramStatusLabel } from "@/lib/programs/program-status"
import {
  getProgramRegistrationAvailabilityLabel,
  isProgramAcceptingRegistration,
} from "@/lib/programs/program-enrollment-availability"
import { ProgramCatalogFilters } from "@/components/programs/program-catalog-filters"
import { ProgramCardActions } from "@/components/programs/program-card-actions"
import { ProgramStatusSelect } from "@/components/programs/program-status-select"
import { cn } from "@/lib/utils"

type PageSearchParams = {
  q?: string
  status?: string
  department?: string
  view?: string
}

function getValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function formatDate(value: string | null) {
  if (!value) return "TBD"

  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function getEnrollmentPercent(program: Program) {
  if (!program.capacity || program.capacity <= 0) return 0
  return Math.min(Math.round((program.enrolled / program.capacity) * 100), 100)
}

function getEnrollmentColor(program: Program) {
  const percent = getEnrollmentPercent(program)

  if (percent >= 90) return "bg-red-500"
  if (percent >= 70) return "bg-amber-500"

  return "bg-green-500"
}

function matchesProgram(program: Program, filters: PageSearchParams) {
  const query = filters.q?.trim().toLowerCase()
  const status = filters.status || "all"
  const department = filters.department || "all"

  const matchesSearch =
    !query ||
    program.name.toLowerCase().includes(query) ||
    program.description?.toLowerCase().includes(query)

  const matchesStatus = status === "all" || program.status === status

  const matchesDepartment =
    department === "all" || program.department_id === department

  return matchesSearch && matchesStatus && matchesDepartment
}

function getStatusBadgeVariant(status: string) {
  switch (status as ProgramStatus) {
    case "active":
      return "default"
    case "paused":
      return "outline"
    default:
      return "secondary"
  }
}

function ProgramCard({
  program,
  offeringCount,
}: {
  program: Program
  offeringCount: number
}) {
  const percent = getEnrollmentPercent(program)
  const acceptingRegistration = isProgramAcceptingRegistration(program)
  const availabilityLabel = getProgramRegistrationAvailabilityLabel(program)
  const ageLabel = program.age_groups?.length
    ? program.age_groups.join(", ")
    : "No age group"

  return (
    <Card className="overflow-hidden">
      <div className="flex gap-4 p-4">
        <div className="aspect-[3/4] w-28 shrink-0 overflow-hidden rounded-md border bg-white sm:w-32">
          {program.flyer_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={program.flyer_url}
              alt={`${program.name} flyer`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-muted/40">
              <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-base font-semibold leading-tight">{program.name}</p>
              {program.subtitle ? (
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                  {program.subtitle}
                </p>
              ) : null}
            </div>
            <ProgramStatusSelect
              programId={program.id}
              status={program.status}
            />
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4 shrink-0" />
            <span>
              {formatDate(program.start_date)} - {formatDate(program.end_date)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 shrink-0" />
              <span>{program.gender || "All"}</span>
            </div>
            <span className="text-muted-foreground/40">·</span>
            <span>{ageLabel}</span>
            <span className="text-muted-foreground/40">·</span>
            <span>
              {offeringCount} offering{offeringCount === 1 ? "" : "s"}
            </span>
          </div>

          <div>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-muted-foreground">Enrollment</span>
              <span>
                {program.enrolled}/{program.capacity}
                {program.waitlist > 0 ? ` (+${program.waitlist} waitlist)` : ""}
              </span>
            </div>

            <p
              className={cn(
                "mb-2 text-xs",
                acceptingRegistration
                  ? "text-emerald-700"
                  : "text-muted-foreground"
              )}
            >
              {availabilityLabel}
            </p>

            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full",
                  acceptingRegistration
                    ? getEnrollmentColor(program)
                    : "bg-muted-foreground/30"
                )}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <ProgramCardActions
              programId={program.id}
              programName={program.name}
              programStatus={program.status}
            />
          </div>
        </div>
      </div>
    </Card>
  )
}

function ProgramsTable({ programs }: { programs: Program[] }) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Program</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Enrollment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[280px]">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {programs.map((program) => (
              <TableRow key={program.id}>
                <TableCell>
                  <p className="font-medium">{program.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {program.description || "No description"}
                  </p>
                </TableCell>

                <TableCell className="text-muted-foreground">
                  {formatDate(program.start_date)} - {formatDate(program.end_date)}
                </TableCell>

                <TableCell>
                  {program.enrolled}/{program.capacity}
                </TableCell>

                <TableCell>
                  <Badge variant={getStatusBadgeVariant(program.status)}>
                    {getProgramStatusLabel(program.status)}
                  </Badge>
                </TableCell>

                <TableCell>
                  <ProgramCardActions
                    programId={program.id}
                    programName={program.name}
                    programStatus={program.status}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export default async function ProgramsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const resolvedSearchParams = await searchParams

  const filters: PageSearchParams = {
    q: getValue(resolvedSearchParams?.q) || "",
    status: getValue(resolvedSearchParams?.status) || "all",
    department: getValue(resolvedSearchParams?.department) || "all",
    view: getValue(resolvedSearchParams?.view) || "cards",
  }

  const [programs, departments] = await Promise.all([
    getPrograms(),
    getDepartments(),
  ])
  const filteredPrograms = programs.filter((program) =>
    matchesProgram(program, filters)
  )
  const offeringCounts = await getOfferingCountsByProgramIds(
    filteredPrograms.map((program) => program.id)
  )

  const viewMode = filters.view === "table" ? "table" : "cards"

  return (
    <>
      <Header title="Programs" />

      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Programs</h1>
            <p className="text-muted-foreground">
              Manage programs, classes, camps, and activities.
            </p>
          </div>

          <Button asChild>
            <Link href="/programs/create">
              <Plus className="mr-2 h-4 w-4" />
              Create Program
            </Link>
          </Button>
        </div>

        <Card>
          <CardContent className="p-4">
            <ProgramCatalogFilters
              departments={departments}
              initialFilters={{
                q: filters.q || "",
                status: filters.status || "all",
                department: filters.department || "all",
                view: viewMode,
              }}
            />
          </CardContent>
        </Card>

        {filteredPrograms.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-12">
            <Archive className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="text-lg font-medium">No programs found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a program or adjust your filters.
            </p>

            <Button className="mt-4" asChild>
              <Link href="/programs/create">
                <Plus className="mr-2 h-4 w-4" />
                Create Program
              </Link>
            </Button>
          </Card>
        ) : viewMode === "table" ? (
          <ProgramsTable programs={filteredPrograms} />
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredPrograms.map((program) => (
              <ProgramCard
                key={program.id}
                program={program}
                offeringCount={offeringCounts.get(program.id) || 0}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}