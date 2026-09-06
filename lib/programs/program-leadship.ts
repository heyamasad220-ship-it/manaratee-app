import type { SupabaseClient } from "@supabase/supabase-js"

import { resolveStaffIdentityForUser } from "@/lib/organizations/work-email-lookups"

export { programLeadNavEntries } from "./program-lead-nav"

export type ProgramLeadship = {
  organizationId: string
  programId: string
  programName: string
  departmentId: string | null
  contactId: string
}

/**
 * Programs where the signed-in contact is Program Lead.
 * Uses the work-email assignment when this login is an org mailbox.
 */
export async function resolveProgramLeads(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string
): Promise<ProgramLeadship[]> {
  const identity = await resolveStaffIdentityForUser(
    supabase,
    organizationId,
    userId
  )
  const contactId = identity.staffContactId
  if (!contactId) return []

  const { data, error } = await supabase
    .from("programs")
    .select("id, name, department_id, lead_contact_id, status")
    .eq("organization_id", organizationId)
    .eq("lead_contact_id", contactId)
    .neq("status", "archived")
    .order("name", { ascending: true })

  if (error) {
    if (
      error.message.includes("lead_contact_id") ||
      error.message.toLowerCase().includes("does not exist")
    ) {
      return []
    }
    console.warn("resolveProgramLeads:", error.message)
    return []
  }

  return (data || []).map((row) => ({
    organizationId,
    programId: row.id as string,
    programName: String(row.name || "Program").trim() || "Program",
    departmentId: (row.department_id as string | null) ?? null,
    contactId,
  }))
}

export function isLeadOfProgram(
  leads: ProgramLeadship[],
  programId: string
): boolean {
  const id = String(programId || "").trim()
  if (!id) return false
  return leads.some((lead) => lead.programId === id)
}
