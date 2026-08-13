import { Header } from "@/components/layout/header"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { getDepartments } from "@/lib/departments/department-queries"
import { ProgramForm } from "@/components/programs/program-form"
import { getOrganizationProgramKindsEntitlement } from "@/lib/programs/organization-program-kinds"
import {
  listAllowedProgramKindsForOrganization,
  organizationAllowsProgramKind,
} from "@/lib/programs/program-kind-policy"
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

  const [departments, organizationId, programKindsEntitlement] =
    await Promise.all([
      getDepartments(),
      getSelectedOrganizationId(),
      getOrganizationProgramKindsEntitlement(),
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

  return (
    <>
      <Header title="Programs" />
      <ProgramForm
        mode="create"
        departments={departments}
        organizationId={organizationId}
        defaultDepartmentId={departmentExists ? defaultDepartmentId : null}
        allowedProgramKinds={allowedProgramKinds}
        lockedProgramKind={lockedProgramKind}
      />
    </>
  )
}
