import { notFound, redirect } from "next/navigation"

import { Header } from "@/components/layout/header"
import { OfferingManageClient } from "@/components/programs/offering-manage-client"
import { workforceDepartmentDetailPath } from "@/lib/departments/department-paths"
import { getDepartments } from "@/lib/departments/department-queries"
import { departmentGroupWorkspaceHref } from "@/lib/donations/donation-group-path"
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
import { getOfferingRosterEnrollments } from "@/lib/programs/program-staff-assignment-queries"

/**
 * Department-scoped offering overview — keeps HR → Departments selected.
 * Edit opens in a dialog (optional `?edit=1`).
 * Session roster: `?session={sessionId}`.
 */
export default async function DepartmentProgramOfferingManagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; programId: string; offeringId: string }>
  searchParams?: Promise<{ tab?: string; edit?: string; session?: string }>
}) {
  const { id: departmentId, programId, offeringId } = await params
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const sessionId = resolvedSearchParams.session?.trim() || null

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

  const [workspaceData, summary, roster, sessionEnrollment, sessionRoster] =
    await Promise.all([
      getOfferingWorkspaceData(
        programId,
        selectedOffering,
        program.organization_id
      ),
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
    ])

  const departmentOverviewHref = departmentGroupWorkspaceHref(departmentId)
  const programOverviewHref = departmentGroupWorkspaceHref(departmentId, {
    yearProgramId: programId,
  })
  const offeringsListHref = departmentGroupWorkspaceHref(departmentId, {
    tab: "programs",
    yearProgramId: programId,
  })
  const backHref = offeringsListHref

  const enrolledNames = roster.map(
    (row) => row.child_name || row.parent_name || "Participant"
  )

  return (
    <>
      <Header
        title={department.name}
        breadcrumbExtras={[
          {
            label: department.name,
            href: departmentOverviewHref,
          },
          {
            label: program.name,
            href: programOverviewHref,
          },
          {
            label: PROGRAM_LABEL_PLURAL,
            href: offeringsListHref,
          },
          {
            label: selectedOffering.name,
            href: sessionRoster
              ? `/workforce/departments/${departmentId}/programs/${programId}/offerings/${offeringId}`
              : undefined,
          },
          ...(sessionRoster
            ? [{ label: sessionRoster.session.name }]
            : []),
        ]}
      />
      <OfferingManageClient
        program={program}
        departmentName={department.name}
        selectedOffering={selectedOffering}
        workspaceData={workspaceData}
        capacityGroups={capacityGroups}
        summary={summary}
        enrolledNames={enrolledNames}
        sessionEnrollment={sessionEnrollment}
        sessionRoster={sessionRoster}
        initialEditOpen={resolvedSearchParams.edit === "1"}
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
