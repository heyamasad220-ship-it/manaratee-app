import Link from "next/link"
import {
  Archive,
  Calendar,
  Eye,
  LayoutGrid,
  List,
  Plus,
  Search,
  Users,
} from "lucide-react"

import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { getPrograms } from "@/lib/programs/program-queries"
import type { Program } from "@/lib/programs/program-types"
import { getProgramStatusLabel } from "@/lib/programs/program-status"
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

function ProgramCard({ program }: { program: Program }) {
  const percent = getEnrollmentPercent(program)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">{program.name}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {program.description || "No description"}
            </p>
          </div>

          <Badge>{getProgramStatusLabel(program.status)}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {program.age_groups?.length ? (
            program.age_groups.map((age) => (
              <Badge key={age} variant="secondary">
                {age}
              </Badge>
            ))
          ) : (
            <Badge variant="secondary">No age group</Badge>
          )}
        </div>

        <div>
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-muted-foreground">Enrollment</span>
            <span>
              {program.enrolled}/{program.capacity}
              {program.waitlist > 0 ? ` (+${program.waitlist} waitlist)` : ""}
            </span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", getEnrollmentColor(program))}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              {formatDate(program.start_date)} - {formatDate(program.end_date)}
            </span>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{program.gender || "All"}</span>
          </div>
        </div>

        <Button variant="outline" size="sm" asChild>
          <Link href={`/programs/${program.id}`}>
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </Link>
        </Button>
      </CardContent>
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
              <TableHead className="w-[120px]" />
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
                  <Badge>{getProgramStatusLabel(program.status)}</Badge>
                </TableCell>

                <TableCell>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/programs/${program.id}`}>View</Link>
                  </Button>
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
    q: getValue(resolvedSearchParams?.q),
    status: getValue(resolvedSearchParams?.status) || "all",
    department: getValue(resolvedSearchParams?.department) || "all",
    view: getValue(resolvedSearchParams?.view) || "cards",
  }

  const supabase = await createClient()

const programs = await getPrograms()

const { data: departmentsData } = await supabase
  .from("departments")
  .select("id, name")
  .order("name")

const departments = departmentsData || []
  const filteredPrograms = programs.filter((program) =>
    matchesProgram(program, filters)
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
            <form className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-1 flex-col gap-4 sm:flex-row">
                <div className="relative flex-1 lg:max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    name="q"
                    defaultValue={filters.q}
                    placeholder="Search programs..."
                    className="pl-9"
                  />
                </div>

                <select
                  name="status"
                  defaultValue={filters.status}
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="all">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="archived">Archived</option>
                </select>

                <select
  name="department"
  defaultValue={filters.department}
  className="h-10 rounded-md border bg-background px-3 text-sm"
>
  <option value="all">All Departments</option>

  {departments.map((department) => (
  <option key={department.id} value={department.id}>
    {department.name}
  </option>
))}
</select>

                <input type="hidden" name="view" value={viewMode} />

                <Button type="submit">Apply</Button>
              </div>

              <div className="flex gap-2">
                <Button
                  variant={viewMode === "cards" ? "secondary" : "outline"}
                  asChild
                >
                  <Link href="/programs?view=cards">
                    <LayoutGrid className="mr-2 h-4 w-4" />
                    Cards
                  </Link>
                </Button>

                <Button
                  variant={viewMode === "table" ? "secondary" : "outline"}
                  asChild
                >
                  <Link href="/programs?view=table">
                    <List className="mr-2 h-4 w-4" />
                    Table
                  </Link>
                </Button>
              </div>
            </form>
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
              <ProgramCard key={program.id} program={program} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}