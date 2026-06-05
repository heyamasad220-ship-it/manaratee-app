import { notFound } from "next/navigation"

import { Header } from "@/components/layout/header"
import { ProgramForm } from "@/components/programs/program-form"
import { getDepartments } from "@/lib/departments/department-queries"
import { getOfferingWorkspaceDataForProgram } from "@/lib/programs/offering-workspace-queries"
import { getProgramCapacityGroups } from "@/lib/programs/program-capacity-group-queries"
import {
  getDefaultOfferingForProgram,
  getOfferingsForProgram,
} from "@/lib/programs/program-offering-queries"
import { getProgramById } from "@/lib/programs/program-queries"
import { getAllRegistrationOptionsForOffering } from "@/lib/programs/program-registration-option-queries"

export default async function EditProgramPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [program, departments, capacityGroups, offerings] = await Promise.all([
    getProgramById(id),
    getDepartments(),
    getProgramCapacityGroups(id),
    getOfferingsForProgram(id),
  ])

  if (!program) {
    notFound()
  }

  const defaultOffering = await getDefaultOfferingForProgram(id)
  const registrationOptions = defaultOffering
    ? await getAllRegistrationOptionsForOffering(defaultOffering.id)
    : []
  const offeringWorkspaceData = await getOfferingWorkspaceDataForProgram(
    id,
    program.organization_id,
    offerings
  )

  return (
    <>
      <Header title="Programs" />
      <ProgramForm
        mode="edit"
        program={program}
        departments={departments}
        capacityGroups={capacityGroups}
        offerings={offerings}
        registrationOptions={registrationOptions}
        defaultOffering={defaultOffering}
        offeringWorkspaceData={offeringWorkspaceData}
      />
    </>
  )
}
