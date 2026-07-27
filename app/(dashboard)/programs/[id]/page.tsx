import { notFound, redirect } from "next/navigation"

import { Header } from "@/components/layout/header"
import { ProgramDetailClient } from "@/components/programs/program-detail-client"
import { getDepartments } from "@/lib/departments/department-queries"
import { departmentGroupWorkspaceHref } from "@/lib/donations/donation-group-path"
import { isSeasonalProgramKind } from "@/lib/programs/program-kind"
import { getOfferingsForProgram } from "@/lib/programs/program-offering-queries"
import { programOfferingManageHref } from "@/lib/programs/program-offering-paths"
import { getProgramById } from "@/lib/programs/program-queries"
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

  // Seasonal camps: one product page (leaf offering settings), no year/offerings chrome.
  if (isSeasonalProgramKind(program.program_kind)) {
    const offerings = await getOfferingsForProgram(id)
    const leaf =
      offerings.find((o) => o.is_default && o.status !== "archived") ||
      offerings.find((o) => o.status !== "archived") ||
      offerings[0]
    if (leaf) {
      redirect(
        programOfferingManageHref(id, leaf.id, {
          departmentId: program.department_id,
        })
      )
    }
  }

  // Academic years with a department are configured from the department workspace.
  if (program.department_id) {
    if (tab === "settings") {
      redirect(
        departmentGroupWorkspaceHref(program.department_id, {
          tab: "settings",
          settingsSection: "year-defaults",
          yearProgramId: program.id,
        })
      )
    }
    if (tab === "reports") {
      redirect(
        departmentGroupWorkspaceHref(program.department_id, {
          tab: "students",
          studentsSection: "roster",
          yearProgramId: program.id,
        })
      )
    }
    if (tab === "offerings") {
      redirect(
        departmentGroupWorkspaceHref(program.department_id, {
          tab: "programs",
          yearProgramId: program.id,
        })
      )
    }
    redirect(
      departmentGroupWorkspaceHref(program.department_id, {
        tab: "overview",
        yearProgramId: program.id,
      })
    )
  }

  // Orphan year/season (no department) — keep standalone detail.
  if (tab === "reports" || tab === "offerings") {
    redirect(`/programs/${program.id}`)
  }

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
        initialTab={tab}
        offerings={offerings.map((offering) => ({
          offering,
          enrolled: enrolledByOffering.get(offering.id) || 0,
        }))}
      />
    </>
  )
}
