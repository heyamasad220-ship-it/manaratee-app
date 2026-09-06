import { Header } from "@/components/layout/header"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { getDepartmentHeadshipForCurrentUser } from "@/lib/departments/department-access"
import { getDepartments } from "@/lib/departments/department-queries"
import { ProgramForm } from "@/components/programs/program-form"
import { getOrganizationProgramKindsEntitlement } from "@/lib/programs/organization-program-kinds"
import {
  listAllowedProgramKindsForOrganization,
  organizationAllowsProgramKind,
} from "@/lib/programs/program-kind-policy"
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import { type ProgramKind } from "@/lib/programs/program-kind"

function getValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function CreateProgramPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const resolved = await searchParams
  const defaultDepartmentId = getValue(resolved?.department) || null
  const kindParam = getValue(resolved?.kind)
  const requestedKind: ProgramKind | null =
    kindParam === "academic" || kindParam === "seasonal"
      ? kindParam
      : null

  const [departments, organizationId, programKindsEntitlement, canManageAllPrograms, headship] =
    await Promise.all([
      getDepartments(),
      getSelectedOrganizationId(),
      getOrganizationProgramKindsEntitlement(),
      hasPermission(PERMISSIONS.PROGRAMS_MANAGE),
      getDepartmentHeadshipForCurrentUser(),
    ])

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const allowedProgramKinds = listAllowedProgramKindsForOrganization(
    programKindsEntitlement
  )
  const lockedProgramKind =
    requestedKind &&
    organizationAllowsProgramKind(programKindsEntitlement, requestedKind)
      ? requestedKind
      : allowedProgramKinds.length === 1
        ? allowedProgramKinds[0]
        : null

  const departmentExists =
    defaultDepartmentId &&
    departments.some((department) => department.id === defaultDepartmentId)

  let visibleDepartments = departments
  let lockedDepartmentId = departmentExists ? defaultDepartmentId : null
  if (!canManageAllPrograms && headship) {
    visibleDepartments = departments.filter(
      (department) => department.id === headship.departmentId
    )
    lockedDepartmentId = headship.departmentId
  }

  return (
    <>
      <Header title="Programs" />
      <ProgramForm
        mode="create"
        departments={visibleDepartments}
        organizationId={organizationId}
        defaultDepartmentId={lockedDepartmentId}
        allowedProgramKinds={allowedProgramKinds}
        lockedProgramKind={lockedProgramKind}
      />
    </>
  )
}
