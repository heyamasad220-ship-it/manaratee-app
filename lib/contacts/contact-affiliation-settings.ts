"use server"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { CONTACTS_SETTINGS_PATH } from "@/lib/contacts/contact-module-label"
import {
  AFFILIATION_RULE_DEFINITIONS,
  defaultAffiliationAutoSyncEnabled,
  isAffiliationModuleAvailable,
  type DerivedAffiliationRole,
} from "@/lib/contacts/contact-affiliation-rules"
import { loadOrganizationSidebarModules } from "@/lib/organizations/load-organization-sidebar-modules"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { normalizeModuleSlug } from "@/lib/modules/module-catalog"

export type OrganizationAffiliationSettingRow = {
  role: DerivedAffiliationRole
  label: string
  trigger: string
  autoAdd: string
  autoRemove: string
  moduleList: string
  moduleSlugs: readonly string[]
  moduleAvailable: boolean
  autoSyncEnabled: boolean
  explicitlyConfigured: boolean
}

function buildEnabledModuleSlugSet(enabledSlugs: Iterable<string>): Set<string> {
  return new Set(Array.from(enabledSlugs, (slug) => normalizeModuleSlug(slug)))
}

export async function loadAffiliationAutoSyncFlags(
  organizationId: string,
  supabaseClient?: SupabaseClient
): Promise<Map<DerivedAffiliationRole, boolean>> {
  const supabase = supabaseClient ?? (await createClient())
  const enabledModules = await loadOrganizationSidebarModules(supabase, organizationId)
  const enabledSlugs = buildEnabledModuleSlugSet(enabledModules.map((row) => row.slug))

  const { data: settings, error } = await supabase
    .from("organization_affiliation_settings")
    .select("role, auto_sync_enabled")
    .eq("organization_id", organizationId)

  if (error && error.code !== "42P01") {
    throw new Error(error.message || "Could not load affiliation settings")
  }

  const explicit = new Map<DerivedAffiliationRole, boolean>()
  for (const row of settings || []) {
    explicit.set(row.role as DerivedAffiliationRole, row.auto_sync_enabled === true)
  }

  const flags = new Map<DerivedAffiliationRole, boolean>()
  for (const definition of AFFILIATION_RULE_DEFINITIONS) {
    if (explicit.has(definition.role)) {
      flags.set(definition.role, explicit.get(definition.role)!)
    } else {
      flags.set(definition.role, defaultAffiliationAutoSyncEnabled(definition.role, enabledSlugs))
    }
  }

  return flags
}

export async function isAffiliationAutoSyncEnabled(
  organizationId: string,
  role: DerivedAffiliationRole,
  supabaseClient?: SupabaseClient
): Promise<boolean> {
  const flags = await loadAffiliationAutoSyncFlags(organizationId, supabaseClient)
  return flags.get(role) ?? false
}

export async function getOrganizationAffiliationSettings(
  organizationIdInput?: string | null
): Promise<OrganizationAffiliationSettingRow[]> {
  const supabase = await createClient()
  const organizationId = organizationIdInput ?? (await getSelectedOrganizationId())

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const enabledModules = await loadOrganizationSidebarModules(supabase, organizationId)
  const enabledSlugs = buildEnabledModuleSlugSet(enabledModules.map((row) => row.slug))

  const { data: settings, error } = await supabase
    .from("organization_affiliation_settings")
    .select("role, auto_sync_enabled")
    .eq("organization_id", organizationId)

  if (error && error.code !== "42P01") {
    throw new Error(error.message || "Could not load affiliation settings")
  }

  const explicit = new Map<string, boolean>()
  for (const row of settings || []) {
    explicit.set(row.role, row.auto_sync_enabled === true)
  }

  return AFFILIATION_RULE_DEFINITIONS.map((definition) => {
    const moduleAvailable = isAffiliationModuleAvailable(definition.role, enabledSlugs)
    const explicitlyConfigured = explicit.has(definition.role)
    const autoSyncEnabled = explicitlyConfigured
      ? explicit.get(definition.role)!
      : defaultAffiliationAutoSyncEnabled(definition.role, enabledSlugs)

    return {
      role: definition.role,
      label: definition.label,
      trigger: definition.trigger,
      autoAdd: definition.autoAdd,
      autoRemove: definition.autoRemove,
      moduleList: definition.moduleList,
      moduleSlugs: definition.moduleSlugs,
      moduleAvailable,
      autoSyncEnabled,
      explicitlyConfigured,
    }
  })
}

function revalidateAffiliationSettingPaths() {
  revalidatePath(CONTACTS_SETTINGS_PATH)
  revalidatePath("/contacts")
  revalidatePath("/contacts/people")
  revalidatePath("/contacts/organizations")
}

export async function setOrganizationAffiliationAutoSync(
  role: DerivedAffiliationRole,
  autoSyncEnabled: boolean
) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const enabledModules = await loadOrganizationSidebarModules(supabase, organizationId)
  const enabledSlugs = buildEnabledModuleSlugSet(enabledModules.map((row) => row.slug))

  if (autoSyncEnabled && !isAffiliationModuleAvailable(role, enabledSlugs)) {
    throw new Error("Enable the required module before turning on this affiliation.")
  }

  const { error } = await supabase.from("organization_affiliation_settings").upsert(
    {
      organization_id: organizationId,
      role,
      auto_sync_enabled: autoSyncEnabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,role" }
  )

  if (error) {
    throw new Error(error.message || "Could not save affiliation setting")
  }

  revalidateAffiliationSettingPaths()
}

export async function setOrganizationAffiliationAutoSyncFromForm(formData: FormData) {
  const role = String(formData.get("role") || "") as DerivedAffiliationRole
  const autoSyncEnabled = String(formData.get("autoSyncEnabled") || "false") === "true"

  if (!AFFILIATION_RULE_DEFINITIONS.some((definition) => definition.role === role)) {
    throw new Error("Invalid affiliation role")
  }

  await setOrganizationAffiliationAutoSync(role, autoSyncEnabled)
}
