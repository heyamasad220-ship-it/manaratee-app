import { notFound } from "next/navigation"

import { Header } from "@/components/layout/header"
import { ProgramForm } from "@/components/programs/program-form"
import { ProgramServiceRequirementsPanel } from "@/components/programs/edit/program-service-requirements-panel"
import { loadProgramServiceRequirementsForm } from "@/lib/service-participations/service-participation-actions"
import { DEFAULT_EVENT_SERVICE_REQUIREMENTS_FORM } from "@/lib/events/event-service-requirements"
import { getDepartments } from "@/lib/departments/department-queries"
import { getOfferingWorkspaceDataForProgram } from "@/lib/programs/offering-workspace-queries"
import { getProgramCapacityGroups } from "@/lib/programs/program-capacity-group-queries"
import {
  getDefaultOfferingForProgram,
  getOfferingsForProgram,
} from "@/lib/programs/program-offering-queries"
import { getProgramById } from "@/lib/programs/program-queries"
import { getAllRegistrationOptionsForOffering } from "@/lib/programs/program-registration-option-queries"
import { getVendorHubVendorTypes } from "@/lib/vendor-hub/vendor-type-queries"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions/permissions"

export default async function EditProgramPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [
    program,
    departments,
    capacityGroups,
    offerings,
    serviceRequirementsForm,
    vendorTypes,
    canManageVendorTypes,
  ] = await Promise.all([
    getProgramById(id),
    getDepartments(),
    getProgramCapacityGroups(id),
    getOfferingsForProgram(id),
    loadProgramServiceRequirementsForm(id),
    getVendorHubVendorTypes({ activeOnly: true }),
    hasAnyPermission(PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE),
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
      <div className="space-y-6">
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
        <ProgramServiceRequirementsPanel
          programId={program.id}
          initialForm={serviceRequirementsForm ?? DEFAULT_EVENT_SERVICE_REQUIREMENTS_FORM}
          vendorTypes={vendorTypes}
          canManageVendorTypes={canManageVendorTypes}
        />
      </div>
    </>
  )
}
