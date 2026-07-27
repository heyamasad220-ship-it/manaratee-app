import { notFound, redirect } from "next/navigation"

import { Header } from "@/components/layout/header"
import { OfferingManageClient } from "@/components/programs/offering-manage-client"
import { workforceDepartmentDetailPath } from "@/lib/departments/department-paths"
import { getDepartments } from "@/lib/departments/department-queries"
import { departmentGroupWorkspaceHref } from "@/lib/donations/donation-group-path"
import { getOfferingManageSummary } from "@/lib/programs/offering-manage-summary"
import { getOfferingWorkspaceData } from "@/lib/programs/offering-workspace-queries"
import { getOfferingCapacityGroups } from "@/lib/programs/program-capacity-group-queries"
import { getOfferingsForProgram } from "@/lib/programs/program-offering-queries"
import { getProgramById } from "@/lib/programs/program-queries"

/**
 * Department-scoped offering/season settings — keeps HR → Departments selected.
 */
export default async function DepartmentProgramOfferingManagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; programId: string; offeringId: string }>
  searchParams?: Promise<{ tab?: string }>
}) {
  const { id: departmentId, programId, offeringId } = await params
  const resolvedSearchParams = searchParams ? await searchParams : {}

  const [program, offerings, departments, capacityGroups] = await Promise.all([
    getProgramById(programId),
    getOfferingsForProgram(programId),
    getDepartments(),
    getOfferingCapacityGroups(offeringId),
  ])

  if (!program) {
    notFound()
  }

  if (program.department_id && program.department_id !== departmentId) {
    redirect(
      `/workforce/departments/${program.department_id}/programs/${programId}/offerings/${offeringId}`
    )
  }

  if (!program.department_id) {
    redirect(`/programs/${programId}/offerings/${offeringId}`)
  }

  const department =
    departments.find((row) => row.id === departmentId) ?? null
  if (!department) {
    notFound()
  }

  const selectedOffering =
    offerings.find((offering) => offering.id === offeringId) ?? null

  if (!selectedOffering) {
    notFound()
  }

  const [workspaceData, summary] = await Promise.all([
    getOfferingWorkspaceData(programId, selectedOffering, program.organization_id),
    getOfferingManageSummary(selectedOffering.id, program.organization_id),
  ])

  const backHref = departmentGroupWorkspaceHref(departmentId, {
    tab: "programs",
    yearProgramId: programId,
  })

  return (
    <>
      <Header title={department.name} />
      <OfferingManageClient
        program={program}
        departmentName={department.name}
        selectedOffering={selectedOffering}
        workspaceData={workspaceData}
        capacityGroups={capacityGroups}
        summary={summary}
        initialTab={resolvedSearchParams.tab}
        navigationContext={{
          mode: "department",
          departmentId,
          departmentName: department.name,
          backHref,
          departmentsListHref: workforceDepartmentDetailPath(departmentId),
        }}
      />
    </>
  )
}
