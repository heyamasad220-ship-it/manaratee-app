import { notFound } from "next/navigation"

import { Header } from "@/components/layout/header"
import { OfferingManageClient } from "@/components/programs/offering-manage-client"
import { getDepartments } from "@/lib/departments/department-queries"
import { getOfferingWorkspaceData } from "@/lib/programs/offering-workspace-queries"
import { getOfferingCapacityGroups } from "@/lib/programs/program-capacity-group-queries"
import {
  normalizeOfferingManageTab,
} from "@/lib/programs/program-offering-paths"
import { getOfferingsForProgram } from "@/lib/programs/program-offering-queries"
import { getProgramById } from "@/lib/programs/program-queries"
import { getOfferingEnrollmentCount } from "@/lib/programs/program-staff-assignment-queries"

export default async function ManageProgramOfferingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; offeringId: string }>
  searchParams?: Promise<{ tab?: string }>
}) {
  const { id, offeringId } = await params
  const resolvedSearch = await searchParams

  const [program, offerings, departments, capacityGroups] = await Promise.all([
    getProgramById(id),
    getOfferingsForProgram(id),
    getDepartments(),
    getOfferingCapacityGroups(offeringId),
  ])

  if (!program) {
    notFound()
  }

  const selectedOffering =
    offerings.find((offering) => offering.id === offeringId) ?? null

  if (!selectedOffering) {
    notFound()
  }

  const [workspaceData, enrolled] = await Promise.all([
    getOfferingWorkspaceData(id, selectedOffering, program.organization_id),
    getOfferingEnrollmentCount(selectedOffering.id, program.organization_id),
  ])

  const departmentName =
    departments.find((department) => department.id === program.department_id)
      ?.name ?? null

  const initialTab = normalizeOfferingManageTab(resolvedSearch?.tab)

  return (
    <>
      <Header title="Programs" />
      <OfferingManageClient
        program={program}
        departmentName={departmentName}
        selectedOffering={selectedOffering}
        workspaceData={workspaceData}
        capacityGroups={capacityGroups}
        enrolled={enrolled}
        initialTab={initialTab}
      />
    </>
  )
}
