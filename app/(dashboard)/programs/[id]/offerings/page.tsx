import { redirect } from "next/navigation"
import { notFound } from "next/navigation"

import { departmentGroupWorkspaceHref } from "@/lib/donations/donation-group-path"
import { isSeasonalProgramKind } from "@/lib/programs/program-kind"
import { getOfferingsForProgram } from "@/lib/programs/program-offering-queries"
import { programOfferingManageHref } from "@/lib/programs/program-offering-paths"
import { getProgramById } from "@/lib/programs/program-queries"

export default async function ProgramOfferingsIndexPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const program = await getProgramById(id)
  if (!program) {
    notFound()
  }

  const offerings = await getOfferingsForProgram(id)
  const preferred =
    offerings.find(
      (offering) => offering.is_default && offering.status !== "archived"
    ) ??
    offerings.find((offering) => offering.status !== "archived") ??
    offerings[0]

  if (isSeasonalProgramKind(program.program_kind)) {
    if (!preferred) {
      redirect(`/programs/${id}`)
    }
    redirect(
      programOfferingManageHref(id, preferred.id, {
        departmentId: program.department_id,
      })
    )
  }

  if (program.department_id) {
    redirect(
      departmentGroupWorkspaceHref(program.department_id, {
        tab: "programs",
        yearProgramId: program.id,
      })
    )
  }

  if (!preferred) {
    redirect(`/programs/${id}`)
  }

  redirect(programOfferingManageHref(id, preferred.id))
}
