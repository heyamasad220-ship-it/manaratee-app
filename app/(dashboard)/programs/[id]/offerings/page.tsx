import { redirect } from "next/navigation"
import { notFound } from "next/navigation"

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
    offerings.find((offering) => offering.status !== "archived") ?? offerings[0]

  if (!preferred) {
    redirect(`/programs/${id}`)
  }

  redirect(programOfferingManageHref(id, preferred.id))
}
