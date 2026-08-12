import { notFound, redirect } from "next/navigation"

import { Header } from "@/components/layout/header"
import { OfferingManageClient } from "@/components/programs/offering-manage-client"
import { getDepartments } from "@/lib/departments/department-queries"
import { getOfferingManageSummary } from "@/lib/programs/offering-manage-summary"
import { getOfferingWorkspaceData } from "@/lib/programs/offering-workspace-queries"
import { getOfferingCapacityGroups } from "@/lib/programs/program-capacity-group-queries"
import { getOfferingsForProgram } from "@/lib/programs/program-offering-queries"
import { programOfferingManageHref } from "@/lib/programs/program-offering-paths"
import { isSeasonalProgramKind } from "@/lib/programs/program-kind"
import { getProgramById } from "@/lib/programs/program-queries"
import { getOfferingRosterEnrollments } from "@/lib/programs/program-staff-assignment-queries"

export default async function ManageProgramOfferingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; offeringId: string }>
  searchParams?: Promise<{ tab?: string; edit?: string }>
}) {
  const { id, offeringId } = await params
  const resolvedSearchParams = searchParams ? await searchParams : {}

  const program = await getProgramById(id)

  if (!program) {
    notFound()
  }

  // Department-linked programs stay under HR → Departments.
  if (program.department_id) {
    const target = programOfferingManageHref(id, offeringId, {
      departmentId: program.department_id,
    })
    const editQuery =
      resolvedSearchParams.edit === "1" ? "?edit=1" : ""
    redirect(`${target}${editQuery}`)
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

  const [workspaceData, summary, roster] = await Promise.all([
    getOfferingWorkspaceData(id, selectedOffering, program.organization_id),
    getOfferingManageSummary(selectedOffering.id, program.organization_id),
    getOfferingRosterEnrollments(selectedOffering.id, program.organization_id),
  ])

  const departmentName =
    departments.find((department) => department.id === program.department_id)
      ?.name ?? null

  const enrolledNames = roster.map(
    (row) => row.child_name || row.parent_name || "Participant"
  )
  const seasonalMode = isSeasonalProgramKind(program.program_kind)

  return (
    <>
      <Header
        title="Programs"
        breadcrumbExtras={
          seasonalMode
            ? [{ label: selectedOffering.name }]
            : [
                { label: program.name, href: `/programs/${program.id}` },
                { label: selectedOffering.name },
              ]
        }
      />
      <OfferingManageClient
        program={program}
        departmentName={departmentName}
        selectedOffering={selectedOffering}
        workspaceData={workspaceData}
        capacityGroups={capacityGroups}
        summary={summary}
        enrolledNames={enrolledNames}
        initialEditOpen={resolvedSearchParams.edit === "1"}
        navigationContext={{
          mode: "programs",
          backHref: "/programs/catalog",
        }}
      />
    </>
  )
}
