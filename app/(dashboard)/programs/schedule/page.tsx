import { redirect } from "next/navigation"

import { ProgramsScheduleClient } from "./schedule-client"
import { resolveProgramScheduleRedirect } from "@/lib/programs/program-schedule-actions"

export default async function ProgramsSchedulePage({
  searchParams,
}: {
  searchParams?: Promise<{ program?: string | string[] }>
}) {
  const resolved = await searchParams
  const programParam = resolved?.program
  const programId = Array.isArray(programParam) ? programParam[0] : programParam

  if (programId) {
    const href = await resolveProgramScheduleRedirect(programId)
    if (href) {
      redirect(href)
    }
  }

  return <ProgramsScheduleClient />
}
