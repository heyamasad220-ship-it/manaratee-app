import { redirect } from "next/navigation"
import { notFound } from "next/navigation"

import { departmentGroupWorkspaceHref } from "@/lib/donations/donation-group-path"
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

  if (program.department_id) {
    redirect(
      departmentGroupWorkspaceHref(program.department_id, {
        tab: "programs",
        yearProgramId: program.id,
      })
    )
  }

  const offerings = await getOfferingsForProgram(id)
  const preferred =
    offerings.find((offering) => offering.status !== "archived") ?? offerings[0]

  if (!preferred) {
    redirect(`/programs/${id}`)
  }

  redirect(programOfferingManageHref(id, preferred.id))
}
