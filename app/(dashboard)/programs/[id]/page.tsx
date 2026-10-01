import { notFound } from "next/navigation"

import { Header } from "@/components/layout/header"
import { ProgramDetailClient } from "@/components/programs/program-detail-client"
import { ProgramWorkspaceClient } from "@/components/programs/program-workspace-client"
import { getDepartments } from "@/lib/departments/department-queries"
import { getOfferingsForProgram } from "@/lib/programs/program-offering-queries"
import { canManageProgram } from "@/lib/programs/program-access"
import { getProgramById } from "@/lib/programs/program-queries"
import { getParticipationsForSource } from "@/lib/service-participations/service-participation-queries"
import { getOfferingEnrollmentCount } from "@/lib/programs/program-staff-assignment-queries"
import type { ProgramWithExtraFields } from "@/components/programs/edit/types"

export default async function ProgramDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab } = await searchParams

  const program = await getProgramById(id)

  if (!program) {
    notFound()
  }

  if (program.department_id) {
    const [departments, volunteerParticipations, canManageSignups] = await Promise.all([
      getDepartments(),
      getParticipationsForSource({
        sourceType: "program",
        sourceId: program.id,
        organizationId: program.organization_id,
      }),
      canManageProgram(program.id),
    ])
    const departmentName =
      departments.find((department) => department.id === program.department_id)
        ?.name ?? "Department"

    return (
      <>
        <Header
          title={program.name}
          breadcrumbExtras={[{ label: program.name }]}
        />
        <ProgramWorkspaceClient
          program={program}
          departmentId={program.department_id}
          departmentName={departmentName}
          volunteerParticipations={volunteerParticipations}
          canManageSignups={canManageSignups}
        />
      </>
    )
  }

  // Orphan year/season (no department) — keep standalone detail.
  const [departments, offerings] = await Promise.all([
    getDepartments(),
    getOfferingsForProgram(id),
  ])

  const enrollmentCounts = await Promise.all(
    offerings.map(async (offering) => ({
      offeringId: offering.id,
      enrolled: await getOfferingEnrollmentCount(
        offering.id,
        program.organization_id
      ),
    }))
  )
  const enrolledByOffering = new Map(
    enrollmentCounts.map((row) => [row.offeringId, row.enrolled])
  )

  const visibility =
    (program as ProgramWithExtraFields).visibility ?? null

  return (
    <>
      <Header title="Programs" />
      <ProgramDetailClient
        program={program}
        departments={departments}
        departmentName={null}
        visibility={visibility}
        initialTab={tab}
        offerings={offerings.map((offering) => ({
          offering,
          enrolled: enrolledByOffering.get(offering.id) || 0,
        }))}
      />
    </>
  )
}
