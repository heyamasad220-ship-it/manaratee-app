import { redirect } from "next/navigation"

import { DepartmentGroupWorkspaceClient } from "@/components/departments/department-group-workspace-client"
import { requireDepartmentView } from "@/lib/departments/department-access"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import { programWorkspaceHrefFromDepartmentYearQuery } from "@/lib/programs/program-workspace-path"

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]
  return value
}

export default async function WorkforceDepartmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    from?: string
    year?: string | string[]
    tab?: string | string[]
    section?: string | string[]
  }>
}) {
  const { id } = await params
  const resolved = await searchParams
  const yearProgramId = firstValue(resolved.year)?.trim()

  if (yearProgramId) {
    redirect(
      programWorkspaceHrefFromDepartmentYearQuery({
        yearProgramId,
        tab: firstValue(resolved.tab),
        section: firstValue(resolved.section),
      })
    )
  }

  await requireDepartmentView(id)
  const from = firstValue(resolved.from)
  const entryPoint = from === "donations" ? "donations" : "hr"

  const [canManageEvents, canRequestEvents] = await Promise.all([
    hasAnyPermission(PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE),
    hasAnyPermission(
      PERMISSIONS.EVENTS_VIEW,
      PERMISSIONS.EVENTS_MANAGE,
      PERMISSIONS.PROGRAMS_VIEW,
      PERMISSIONS.PROGRAMS_MANAGE
    ),
  ])

  return (
    <DepartmentGroupWorkspaceClient
      departmentId={id}
      entryPoint={entryPoint}
      canManageEvents={canManageEvents}
      canRequestEvents={canRequestEvents}
    />
  )
}
