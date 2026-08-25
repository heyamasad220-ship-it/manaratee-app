import { notFound } from "next/navigation"

import { Header } from "@/components/layout/header"
import { OfferingManageClient } from "@/components/programs/offering-manage-client"
import { getDepartments } from "@/lib/departments/department-queries"
import { getOfferingManageSummary } from "@/lib/programs/offering-manage-summary"
import {
  getOfferingSessionEnrollmentSummary,
  getOfferingSessionRoster,
} from "@/lib/programs/offering-session-enrollment"
import { getOfferingWorkspaceData } from "@/lib/programs/offering-workspace-queries"
import { getOfferingCapacityGroups } from "@/lib/programs/program-capacity-group-queries"
import { PROGRAM_LABEL_PLURAL } from "@/lib/programs/program-display-labels"
import { getOfferingsForProgram } from "@/lib/programs/program-offering-queries"
import { getProgramById } from "@/lib/programs/program-queries"
import { listMoveOfferingTargets } from "@/lib/programs/move-enrollment-offering-targets"
import { getOfferingRosterEnrollments } from "@/lib/programs/program-staff-assignment-queries"
import { programWorkspaceHref } from "@/lib/programs/program-workspace-path"

export default async function ManageProgramOfferingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; offeringId: string }>
  searchParams?: Promise<{ tab?: string; edit?: string; session?: string }>
}) {
  const { id, offeringId } = await params
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const sessionId = resolvedSearchParams.session?.trim() || null

  const program = await getProgramById(id)

  if (!program) {
    notFound()
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

  const [workspaceData, summary, roster, sessionEnrollment, sessionRoster, siblingOfferings] =
    await Promise.all([
      getOfferingWorkspaceData(id, selectedOffering, program.organization_id),
      getOfferingManageSummary(selectedOffering.id, program.organization_id),
      getOfferingRosterEnrollments(
        selectedOffering.id,
        program.organization_id
      ),
      getOfferingSessionEnrollmentSummary(
        selectedOffering.id,
        program.organization_id
      ),
      sessionId
        ? getOfferingSessionRoster(
            selectedOffering.id,
            sessionId,
            program.organization_id
          )
        : Promise.resolve(null),
      listMoveOfferingTargets(
        id,
        program.organization_id,
        selectedOffering.id
      ),
    ])

  const departmentName =
    departments.find((department) => department.id === program.department_id)
      ?.name ?? null

  return (
    <>
      <Header
        title="Programs"
        breadcrumbExtras={[
          { label: program.name, href: programWorkspaceHref(program.id) },
          {
            label: PROGRAM_LABEL_PLURAL,
            href: programWorkspaceHref(program.id, { tab: "offerings" }),
          },
          {
            label: selectedOffering.name,
            href: sessionRoster
              ? `/programs/${program.id}/offerings/${offeringId}`
              : undefined,
          },
          ...(sessionRoster
            ? [{ label: sessionRoster.session.name }]
            : []),
        ]}
      />
      <OfferingManageClient
        program={program}
        departmentName={departmentName}
        selectedOffering={selectedOffering}
        workspaceData={workspaceData}
        capacityGroups={capacityGroups}
        summary={summary}
        enrolledRoster={roster}
        siblingOfferings={siblingOfferings}
        sessionEnrollment={sessionEnrollment}
        sessionRoster={sessionRoster}
        initialEditOpen={resolvedSearchParams.edit === "1"}
        navigationContext={{
          mode: "programs",
          backHref: programWorkspaceHref(program.id, { tab: "offerings" }),
        }}
      />
    </>
  )
}
