import { notFound } from "next/navigation"

import { Header } from "@/components/layout/header"
import { CarTagsWorkspace } from "@/components/programs/car-tags/car-tags-workspace"
import { getProgramCapacityGroups } from "@/lib/programs/program-capacity-group-queries"
import {
  getCarTagProgramContext,
  getCarTagRowsForProgram,
} from "@/lib/programs/car-tag-queries"
import { getProgramById } from "@/lib/programs/program-queries"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

function getSingleParam(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function ProgramCarTagsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const resolvedSearchParams = await searchParams
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    notFound()
  }

  const program = await getProgramById(id)

  if (!program) {
    notFound()
  }

  const sessionFilter = getSingleParam(resolvedSearchParams?.session)
  const enrollmentParam = getSingleParam(resolvedSearchParams?.enrollment)
  const enrollmentsParam = getSingleParam(resolvedSearchParams?.enrollments)

  const initialEnrollmentIds = [
    ...(enrollmentParam ? [enrollmentParam] : []),
    ...(enrollmentsParam
      ? enrollmentsParam.split(",").map((value) => value.trim()).filter(Boolean)
      : []),
  ]

  const [tagBundle, capacityGroups, { sessions }] = await Promise.all([
    getCarTagRowsForProgram(id, organizationId),
    getProgramCapacityGroups(id),
    getCarTagProgramContext(id),
  ])

  if (!tagBundle) {
    notFound()
  }

  return (
    <>
      <Header title="Programs" />

      <div className="p-6">
        <CarTagsWorkspace
          programId={id}
          programName={tagBundle.programName}
          allRows={tagBundle.rows}
          sessions={sessions}
          capacityGroups={capacityGroups.map((group) => ({
            id: group.id || group.name,
            name: group.name,
            grade_levels: group.grade_levels || [],
          }))}
          initialSessionId={sessionFilter}
          initialEnrollmentIds={
            initialEnrollmentIds.length > 0 ? initialEnrollmentIds : undefined
          }
        />
      </div>
    </>
  )
}
