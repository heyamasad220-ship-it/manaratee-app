import { redirect } from "next/navigation"

import { programWorkspaceHref } from "@/lib/programs/program-workspace-path"

/** Offerings for a program live on the Programs module workspace. */
export default async function ProgramOfferingsIndexPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(programWorkspaceHref(id, { tab: "offerings" }))
}
