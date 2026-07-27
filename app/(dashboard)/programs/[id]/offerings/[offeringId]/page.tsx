import { notFound, redirect } from "next/navigation"

import { Header } from "@/components/layout/header"
import { OfferingManageClient } from "@/components/programs/offering-manage-client"
import { getDepartments } from "@/lib/departments/department-queries"
import { getOfferingManageSummary } from "@/lib/programs/offering-manage-summary"
import { getOfferingWorkspaceData } from "@/lib/programs/offering-workspace-queries"
import { getOfferingCapacityGroups } from "@/lib/programs/program-capacity-group-queries"
import { getOfferingsForProgram } from "@/lib/programs/program-offering-queries"
import { programOfferingManageHref } from "@/lib/programs/program-offering-paths"
import { getProgramById } from "@/lib/programs/program-queries"

export default async function ManageProgramOfferingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; offeringId: string }>
  searchParams?: Promise<{ tab?: string }>
}) {
  const { id, offeringId } = await params
  const resolvedSearchParams = searchParams ? await searchParams : {}

  const program = await getProgramById(id)

  if (!program) {
    notFound()
  }

  // Department-linked programs stay under HR → Departments.
  if (program.department_id) {
    redirect(
      programOfferingManageHref(id, offeringId, {
        departmentId: program.department_id,
      })
    )
  }

  const [offerings, departments, capacityGroups] = await Promise.all([
    getOfferingsForProgram(id),
    getDepartments(),
    getOfferingCapacityGroups(offeringId),
  ])

  const selectedOffering =
    offerings.find((offering) => offering.id === offeringId) ?? null

  if (!selectedOffering) {
    notFound()
  }

  const [workspaceData, summary] = await Promise.all([
    getOfferingWorkspaceData(id, selectedOffering, program.organization_id),
    getOfferingManageSummary(selectedOffering.id, program.organization_id),
  ])

  const departmentName =
    departments.find((department) => department.id === program.department_id)
      ?.name ?? null

  return (
    <>
      <Header title="Programs" />
      <OfferingManageClient
        program={program}
        departmentName={departmentName}
        selectedOffering={selectedOffering}
        workspaceData={workspaceData}
        capacityGroups={capacityGroups}
        summary={summary}
        initialTab={resolvedSearchParams.tab}
        navigationContext={{
          mode: "programs",
          backHref: "/programs/catalog",
        }}
      />
    </>
  )
}
