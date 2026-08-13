"use server"

import { revalidatePath } from "next/cache"

import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { requireOrganizationSuperAdmin } from "@/lib/organizations/organization-billing-access"
import {
  normalizeOrganizationProgramKinds,
  type OrganizationProgramKindsEntitlement,
} from "@/lib/programs/program-kind-policy"
import { getServiceRoleClient } from "@/lib/platform/require-platform-admin"
import { createClient } from "@/lib/supabase/server"

export async function getOrganizationProgramKindsEntitlement(): Promise<OrganizationProgramKindsEntitlement> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return "both"
  return getOrganizationProgramKindsEntitlementForOrg(organizationId)
}

export async function getOrganizationProgramKindsEntitlementForOrg(
  organizationId: string
): Promise<OrganizationProgramKindsEntitlement> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("organizations")
    .select("program_kinds")
    .eq("id", organizationId)
    .maybeSingle()

  if (error) {
    // Column missing until scripts/246 is applied — allow both.
    if (/program_kinds|does not exist/i.test(error.message || "")) {
      return "both"
    }
    return "both"
  }

  return normalizeOrganizationProgramKinds(
    (data as { program_kinds?: string | null } | null)?.program_kinds
  )
}

async function writeOrganizationProgramKinds(
  organizationId: string,
  programKinds: OrganizationProgramKindsEntitlement,
  client: {
    from: (table: string) => {
      update: (values: Record<string, unknown>) => {
        eq: (
          column: string,
          value: string
        ) => PromiseLike<{ error: { message: string } | null }>
      }
    }
  }
): Promise<{ success: true } | { success: false; error: string }> {
  const next = normalizeOrganizationProgramKinds(programKinds)
  const { error } = await client
    .from("organizations")
    .update({ program_kinds: next })
    .eq("id", organizationId)

  if (error) {
    if (/program_kinds|does not exist/i.test(error.message || "")) {
      return {
        success: false,
        error:
          "Run scripts/246_organization_program_kinds.sql in Supabase before changing program modes.",
      }
    }
    return { success: false, error: error.message }
  }

  revalidatePath("/billing")
  revalidatePath("/programs")
  revalidatePath("/workforce")
  revalidatePath("/admin/organizations")
  return { success: true }
}

/** Tenant org super-admin: update packaging for the selected organization. */
export async function updateSelectedOrganizationProgramKindsAction(
  programKinds: OrganizationProgramKindsEntitlement
): Promise<
  | { success: true; programKinds: OrganizationProgramKindsEntitlement }
  | { success: false; error: string }
> {
  try {
    await requireOrganizationSuperAdmin()
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Not authorized.",
    }
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false, error: "No organization selected." }
  }

  const next = normalizeOrganizationProgramKinds(programKinds)
  const supabase = await createClient()
  const result = await writeOrganizationProgramKinds(organizationId, next, supabase)
  if (!result.success) return result
  return { success: true, programKinds: next }
}

/** Platform admin path — service role write for any organization. */
export async function updateOrganizationProgramKindsAsPlatformAdmin(
  organizationId: string,
  programKinds: OrganizationProgramKindsEntitlement
): Promise<
  | { success: true; programKinds: OrganizationProgramKindsEntitlement }
  | { success: false; error: string }
> {
  const next = normalizeOrganizationProgramKinds(programKinds)
  const admin = getServiceRoleClient()
  const result = await writeOrganizationProgramKinds(organizationId, next, admin)
  if (!result.success) return result
  return { success: true, programKinds: next }
}
