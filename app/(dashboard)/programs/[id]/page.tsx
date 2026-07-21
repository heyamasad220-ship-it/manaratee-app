import { notFound } from "next/navigation"

import { Header } from "@/components/layout/header"
import { ProgramDetailClient } from "@/components/programs/program-detail-client"
import { getDepartments } from "@/lib/departments/department-queries"
import { getOfferingsForProgram } from "@/lib/programs/program-offering-queries"
import { getProgramById } from "@/lib/programs/program-queries"
import { getOfferingEnrollmentCount } from "@/lib/programs/program-staff-assignment-queries"
import type { ProgramWithExtraFields } from "@/components/programs/edit/types"

export default async function ProgramDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [program, departments, offerings] = await Promise.all([
    getProgramById(id),
    getDepartments(),
    getOfferingsForProgram(id),
  ])

  if (!program) {
    notFound()
  }

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

  const departmentName =
    departments.find((department) => department.id === program.department_id)?.name ??
    null
  const visibility =
    (program as ProgramWithExtraFields).visibility ?? null

  return (
    <>
      <Header title="Programs" />
      <ProgramDetailClient
        program={program}
        departments={departments}
        departmentName={departmentName}
        visibility={visibility}
        offerings={offerings.map((offering) => ({
          offering,
          enrolled: enrolledByOffering.get(offering.id) || 0,
        }))}
      />
    </>
  )
}
