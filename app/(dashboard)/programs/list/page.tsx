import Link from "next/link"
import { Plus } from "lucide-react"

import { Header } from "@/components/layout/header"
import { ProgramsListClient } from "@/components/programs/programs-list-client"
import { Button } from "@/components/ui/button"
import { getDepartments } from "@/lib/departments/department-queries"
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import { getProgramListStatsByProgramIds } from "@/lib/programs/program-offering-queries"
import { getStaffListPrograms } from "@/lib/programs/program-queries"
import { parseProgramsListFilters } from "@/lib/programs/programs-list-filters"
import { redirectOrgWideProgramPagesForDepartmentHead } from "@/lib/programs/program-access"

export default async function ProgramsListPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  await redirectOrgWideProgramPagesForDepartmentHead()
  const resolvedSearchParams = await searchParams
  const initialFilters = parseProgramsListFilters(resolvedSearchParams || {})

  const [programs, departments, canCreateProgram] = await Promise.all([
    getStaffListPrograms(),
    getDepartments(),
    hasPermission(PERMISSIONS.PROGRAMS_MANAGE),
  ])

  const sorted = [...programs].sort((left, right) => {
    const leftDate = left.start_date || ""
    const rightDate = right.start_date || ""
    if (leftDate !== rightDate) return rightDate.localeCompare(leftDate)
    return left.name.localeCompare(right.name)
  })

  const statsMap = await getProgramListStatsByProgramIds(
    sorted.map((program) => program.id)
  )
  const statsByProgramId = Object.fromEntries(statsMap)
  const createHref = canCreateProgram ? "/programs/create" : null
  const departmentOptions = departments
    .map((department) => ({
      id: department.id as string,
      name: (department.name as string) || "Department",
    }))
    .sort((left, right) => left.name.localeCompare(right.name))

  return (
    <>
      <Header title="Programs" />
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Programs</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage programs across all departments.
            </p>
          </div>
          {createHref ? (
            <Button asChild size="sm">
              <Link href={createHref}>
                <Plus className="h-4 w-4" />
                New Program
              </Link>
            </Button>
          ) : null}
        </div>
        <ProgramsListClient
          programs={sorted}
          departments={departmentOptions}
          statsByProgramId={statsByProgramId}
          createHref={createHref}
          initialFilters={initialFilters}
        />
      </div>
    </>
  )
}
