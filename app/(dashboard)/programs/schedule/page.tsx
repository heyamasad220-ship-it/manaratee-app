import { redirect } from "next/navigation"

import { resolveProgramScheduleRedirect } from "@/lib/programs/program-schedule-actions"

/**
 * Legacy Programs → Schedule route.
 * - `?program=` → offering Schedule tab (unchanged)
 * - bare URL → Programs list (Schedule lives on Program Workspace)
 */
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

  redirect("/programs/list")
}
