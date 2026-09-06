"use server"

import { revalidatePath } from "next/cache"

import { workforceDepartmentDetailPath } from "@/lib/departments/department-paths"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { canManageProgram } from "@/lib/programs/program-access"
import { programWorkspaceHref } from "@/lib/programs/program-workspace-path"
import { createClient } from "@/lib/supabase/server"

export type ProgramLeadCandidate = {
  contactId: string
  fullName: string
  employmentStatus: string | null
}

export async function listProgramLeadCandidatesAction(programId: string): Promise<
  | { success: true; candidates: ProgramLeadCandidate[] }
  | { success: false; error: string }
> {
  if (!(await canManageProgram(programId))) {
    return { success: false, error: "You do not have permission to manage this program." }
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false, error: "No organization selected." }
  }

  const supabase = await createClient()
  const { data: program, error: programError } = await supabase
    .from("programs")
    .select("id, department_id, lead_contact_id")
    .eq("organization_id", organizationId)
    .eq("id", programId)
    .maybeSingle()

  if (programError || !program) {
    if (programError && /lead_contact_id/i.test(programError.message || "")) {
      return {
        success: false,
        error: "Run scripts/290_program_lead_contact.sql in Supabase, then try again.",
      }
    }
    return { success: false, error: "Program not found." }
  }

  const departmentId = (program.department_id as string | null) ?? null
  const currentLeadId = (program.lead_contact_id as string | null) ?? null
  const byContact = new Map<string, ProgramLeadCandidate>()

  if (departmentId) {
    const { data: staffRows, error: staffError } = await supabase
      .from("staff")
      .select("contact_id, first_name, last_name, status")
      .eq("organization_id", organizationId)
      .eq("department_id", departmentId)
      .order("last_name", { ascending: true })

    if (staffError) {
      return { success: false, error: staffError.message }
    }

    for (const row of staffRows || []) {
      const contactId = (row.contact_id as string | null) ?? null
      if (!contactId || byContact.has(contactId)) continue
      const fullName =
        `${(row.first_name as string) || ""} ${(row.last_name as string) || ""}`.trim() ||
        "Unnamed"
      byContact.set(contactId, {
        contactId,
        fullName,
        employmentStatus: (row.status as string | null) ?? null,
      })
    }
  }

  if (currentLeadId && !byContact.has(currentLeadId)) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("id, full_name")
      .eq("organization_id", organizationId)
      .eq("id", currentLeadId)
      .maybeSingle()
    byContact.set(currentLeadId, {
      contactId: currentLeadId,
      fullName: String(contact?.full_name || "Current lead").trim() || "Current lead",
      employmentStatus: null,
    })
  }

  return { success: true, candidates: [...byContact.values()] }
}

export async function setProgramLeadAction(input: {
  programId: string
  contactId: string | null
}): Promise<{ success: true } | { success: false; error: string }> {
  if (!(await canManageProgram(input.programId))) {
    return { success: false, error: "You do not have permission to manage this program." }
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false, error: "No organization selected." }
  }

  const supabase = await createClient()
  const { data: program, error: programError } = await supabase
    .from("programs")
    .select("id, department_id")
    .eq("organization_id", organizationId)
    .eq("id", input.programId)
    .maybeSingle()

  if (programError || !program) {
    return { success: false, error: "Program not found." }
  }

  const nextContactId = input.contactId?.trim() || null
  const departmentId = (program.department_id as string | null) ?? null
  if (nextContactId) {
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("id", nextContactId)
      .maybeSingle()

    if (contactError || !contact) {
      return { success: false, error: "That person was not found." }
    }

    if (departmentId) {
      const { data: staffRow } = await supabase
        .from("staff")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("department_id", departmentId)
        .eq("contact_id", nextContactId)
        .limit(1)
        .maybeSingle()

      if (!staffRow) {
        return {
          success: false,
          error: "Program Lead must be an employee of this department.",
        }
      }
    }
  }

  const { error } = await supabase
    .from("programs")
    .update({ lead_contact_id: nextContactId })
    .eq("organization_id", organizationId)
    .eq("id", input.programId)

  if (error) {
    if (/lead_contact_id/i.test(error.message || "")) {
      return {
        success: false,
        error: "Run scripts/290_program_lead_contact.sql in Supabase, then try again.",
      }
    }
    return { success: false, error: error.message || "Could not save the program lead." }
  }

  revalidatePath(programWorkspaceHref(input.programId))
  revalidatePath("/programs")
  revalidatePath("/customer/staff")
  if (departmentId) {
    revalidatePath(workforceDepartmentDetailPath(departmentId))
  }

  return { success: true }
}

export async function listProgramsLedByContactAction(contactId: string): Promise<
  Array<{ programId: string; programName: string; departmentId: string | null }>
> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId || !contactId.trim()) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("programs")
    .select("id, name, department_id")
    .eq("organization_id", organizationId)
    .eq("lead_contact_id", contactId)
    .neq("status", "archived")
    .order("name", { ascending: true })

  if (error) return []

  return (data || []).map((row) => ({
    programId: row.id as string,
    programName: String(row.name || "Program").trim() || "Program",
    departmentId: (row.department_id as string | null) ?? null,
  }))
}
