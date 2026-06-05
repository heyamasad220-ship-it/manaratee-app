"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/permissions/permissions"
import type { ProgramStatus } from "@/lib/programs/program-status"
import { PROGRAMS_FINANCIAL_ASSISTANCE_PATH } from "@/lib/applications/application-routes"

export type ProgramFinancialAssistanceSettings = {
  id: string
  name: string
  status: ProgramStatus
  financial_assistance_enabled: boolean
  financial_assistance_open: boolean
  financial_assistance_close_date: string | null
  financial_assistance_instructions: string | null
}

export type ProgramFinancialAssistanceActionResult =
  | { success: true }
  | { success: false; error: string }

async function requireProgramsManagePermission() {
  const canManage = await hasPermission(PERMISSIONS.PROGRAMS_MANAGE)

  if (!canManage) {
    throw new Error("You do not have permission to manage program settings.")
  }
}

function revalidateFinancialAssistancePaths(programId: string) {
  revalidatePath(PROGRAMS_FINANCIAL_ASSISTANCE_PATH)
  revalidatePath(`/programs/${programId}/edit`)
  revalidatePath(`/customer/programs/${programId}/financial-assistance`)
}

export async function getProgramsFinancialAssistanceSettings(): Promise<
  ProgramFinancialAssistanceSettings[]
> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return []
  }

  const { data, error } = await supabase
    .from("programs")
    .select(
      "id, name, status, financial_assistance_enabled, financial_assistance_open, financial_assistance_close_date, financial_assistance_instructions"
    )
    .eq("organization_id", organizationId)
    .neq("status", "archived")
    .order("name", { ascending: true })

  if (error) {
    console.error("[getProgramsFinancialAssistanceSettings]", error)
    throw new Error("Failed to load program financial assistance settings.")
  }

  return (data ?? []) as ProgramFinancialAssistanceSettings[]
}

export async function setProgramFinancialAssistanceEnabled(
  programId: string,
  enabled: boolean
): Promise<ProgramFinancialAssistanceActionResult> {
  try {
    await requireProgramsManagePermission()

    const supabase = await createClient()
    const organizationId = await getSelectedOrganizationId()

    if (!organizationId) {
      return { success: false, error: "No organization selected." }
    }

    const updatePayload: Record<string, unknown> = {
      financial_assistance_enabled: enabled,
      updated_at: new Date().toISOString(),
    }

    if (!enabled) {
      updatePayload.financial_assistance_open = false
    }

    const { error } = await supabase
      .from("programs")
      .update(updatePayload)
      .eq("id", programId)
      .eq("organization_id", organizationId)

    if (error) {
      console.error("[setProgramFinancialAssistanceEnabled]", error)
      return {
        success: false,
        error: "Failed to update financial assistance setting.",
      }
    }

    revalidateFinancialAssistancePaths(programId)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update financial assistance setting.",
    }
  }
}

export async function updateProgramFinancialAssistanceSettings(input: {
  programId: string
  financial_assistance_enabled: boolean
  financial_assistance_open: boolean
  financial_assistance_close_date: string | null
  financial_assistance_instructions: string | null
}): Promise<ProgramFinancialAssistanceActionResult> {
  try {
    await requireProgramsManagePermission()

    const supabase = await createClient()
    const organizationId = await getSelectedOrganizationId()

    if (!organizationId) {
      return { success: false, error: "No organization selected." }
    }

    const { error } = await supabase
      .from("programs")
      .update({
        financial_assistance_enabled: input.financial_assistance_enabled,
        financial_assistance_open: input.financial_assistance_enabled
          ? input.financial_assistance_open
          : false,
        financial_assistance_close_date:
          input.financial_assistance_close_date || null,
        financial_assistance_instructions:
          input.financial_assistance_instructions?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.programId)
      .eq("organization_id", organizationId)

    if (error) {
      console.error("[updateProgramFinancialAssistanceSettings]", error)
      return {
        success: false,
        error: "Failed to save financial assistance settings.",
      }
    }

    revalidateFinancialAssistancePaths(input.programId)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to save financial assistance settings.",
    }
  }
}
