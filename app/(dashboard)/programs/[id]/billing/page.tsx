import { redirect } from "next/navigation"

import {
  programOfferingManageHref,
  programOfferingsIndexHref,
} from "@/lib/programs/program-offering-paths"
import { getOfferingsForProgram } from "@/lib/programs/program-offering-queries"
import { getProgramById } from "@/lib/programs/program-queries"

export default async function ProgramBillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ offering?: string }>
}) {
  const { id } = await params
  const { offering: offeringParam } = await searchParams

  const program = await getProgramById(id)
  if (!program) {
    redirect("/programs/catalog")
  }

  const offerings = await getOfferingsForProgram(id)
  const selected =
    (offeringParam
      ? offerings.find((offering) => offering.id === offeringParam)
      : null) ??
    offerings.find((offering) => offering.status !== "archived") ??
    offerings[0] ??
    null

  if (selected) {
    redirect(
      programOfferingManageHref(id, selected.id, {
        departmentId: program.department_id,
      })
    )
  }

  redirect(programOfferingsIndexHref(id))
}
