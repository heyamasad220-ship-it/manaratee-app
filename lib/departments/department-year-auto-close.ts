import type { SupabaseClient } from "@supabase/supabase-js"

import { DEPARTMENT_OPEN_PROGRAM_STATUSES } from "@/lib/departments/department-program-statuses"
import { todayIsoDate } from "@/lib/dates/date-input-utils"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { createClient } from "@/lib/supabase/server"

export type AutoCloseExpiredYearProgramsResult = {
  closedCount: number
  closedProgramIds: string[]
}

async function resolveAutoCloseClient(preferred?: SupabaseClient) {
  if (preferred) return preferred
  try {
    return createServiceRoleClient()
  } catch {
    return createClient()
  }
}

/**
 * After the year/season end date, mark the program (and its non-archived
 * offerings) as closed. Closed years stay visible and editable in the
 * department workspace; they just leave the “open” operating set.
 *
 * Idempotent: only updates draft / active / paused rows with end_date < today.
 */
export async function autoCloseExpiredYearPrograms(input: {
  organizationId: string
  departmentId?: string
  /** Override “today” (YYYY-MM-DD) for tests. */
  asOfDate?: string
  supabase?: SupabaseClient
}): Promise<AutoCloseExpiredYearProgramsResult> {
  const empty: AutoCloseExpiredYearProgramsResult = {
    closedCount: 0,
    closedProgramIds: [],
  }
  if (!input.organizationId) return empty

  const today = input.asOfDate || todayIsoDate()
  const supabase = await resolveAutoCloseClient(input.supabase)

  let query = supabase
    .from("programs")
    .select("id")
    .eq("organization_id", input.organizationId)
    .in("status", [...DEPARTMENT_OPEN_PROGRAM_STATUSES])
    .not("end_date", "is", null)
    .lt("end_date", today)

  if (input.departmentId) {
    query = query.eq("department_id", input.departmentId)
  }

  const { data: expired, error: findError } = await query
  if (findError) {
    console.error("autoCloseExpiredYearPrograms find:", findError.message)
    return empty
  }

  const ids = (expired || [])
    .map((row) => row.id as string)
    .filter(Boolean)
  if (ids.length === 0) return empty

  const nowIso = new Date().toISOString()

  const { error: programError } = await supabase
    .from("programs")
    .update({
      status: "closed",
      updated_at: nowIso,
    })
    .eq("organization_id", input.organizationId)
    .in("id", ids)
    .in("status", [...DEPARTMENT_OPEN_PROGRAM_STATUSES])

  if (programError) {
    console.error("autoCloseExpiredYearPrograms programs:", programError.message)
    return empty
  }

  const { error: offeringError } = await supabase
    .from("program_offerings")
    .update({
      status: "closed",
      updated_at: nowIso,
    })
    .eq("organization_id", input.organizationId)
    .in("program_id", ids)
    .neq("status", "archived")

  if (offeringError) {
    console.error(
      "autoCloseExpiredYearPrograms offerings:",
      offeringError.message
    )
  }

  return {
    closedCount: ids.length,
    closedProgramIds: ids,
  }
}
