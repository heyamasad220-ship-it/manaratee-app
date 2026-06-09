import { createClient, SupabaseClient } from "@supabase/supabase-js"
import {
  CORE_MODULE_SLUGS,
  expandEnabledModuleSlugs,
  getModuleToggleTargets,
  getSubscriptionBundle,
  isCapabilityModuleSlug,
  isCoreModuleSlug,
  isProductModuleSlug,
  normalizeModuleSlug,
  PRODUCT_MODULE_SLUGS,
  SUBSCRIPTION_BUNDLES,
} from "@/lib/modules/module-catalog"

type ModuleRow = {
  id: string
  slug: string
  name: string
  description: string | null
  is_core: boolean | null
  include_in_catalog: boolean | null
}

type OrganizationModuleRow = {
  id: string
  enabled: boolean
  enabled_by_plan: boolean | null
  manually_overridden: boolean | null
  modules: ModuleRow | ModuleRow[] | null
}

export type OrganizationModuleStatus = {
  id: string
  slug: string
  name: string
  description: string | null
  enabled: boolean
  isCore: boolean
  isProduct: boolean
  isCapability: boolean
  includeInCatalog: boolean
  enabledByPlan: boolean
  organizationModuleId?: string
}

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function unwrapModule(
  modules: OrganizationModuleRow["modules"]
): ModuleRow | null {
  if (!modules) return null
  return Array.isArray(modules) ? modules[0] ?? null : modules
}

async function loadModuleSlugMap(admin: SupabaseClient) {
  const { data, error } = await admin.from("modules").select("id, slug")

  if (error) {
    throw new Error(error.message)
  }

  const bySlug = new Map<string, string>()
  for (const row of data ?? []) {
    bySlug.set(row.slug, row.id)
  }
  return bySlug
}

async function upsertOrganizationModule(
  admin: SupabaseClient,
  organizationId: string,
  moduleId: string,
  enabled: boolean,
  manuallyOverridden: boolean
) {
  const { data: existing, error: existingError } = await admin
    .from("organization_modules")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("module_id", moduleId)
    .maybeSingle()

  if (existingError) {
    throw new Error(existingError.message)
  }

  if (existing?.id) {
    const { error } = await admin
      .from("organization_modules")
      .update({
        enabled,
        manually_overridden: manuallyOverridden,
      })
      .eq("id", existing.id)

    if (error) {
      throw new Error(error.message)
    }
    return
  }

  const { error } = await admin.from("organization_modules").insert({
    organization_id: organizationId,
    module_id: moduleId,
    enabled,
    manually_overridden: manuallyOverridden,
    enabled_by_plan: false,
  })

  if (error) {
    throw new Error(error.message)
  }
}

export async function getOrganizationModuleAccess(organizationId: string) {
  const admin = createAdminClient()

  const [
    { data: org, error: orgError },
    { data, error },
    { data: allModules, error: modulesError },
  ] = await Promise.all([
    admin
      .from("organizations")
      .select("subscription_bundle_slug")
      .eq("id", organizationId)
      .maybeSingle(),
    admin
      .from("organization_modules")
      .select(
        `
        id,
        enabled,
        enabled_by_plan,
        manually_overridden,
        modules (
          id,
          slug,
          name,
          description,
          is_core,
          include_in_catalog
        )
      `
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true }),
    admin
      .from("modules")
      .select("id, slug, name, description, is_core, include_in_catalog"),
  ])

  if (orgError) {
    throw new Error(orgError.message)
  }

  if (error) {
    throw new Error(error.message)
  }

  if (modulesError) {
    throw new Error(modulesError.message)
  }

  const moduleMetaBySlug = new Map<string, ModuleRow>()
  for (const row of allModules ?? []) {
    moduleMetaBySlug.set(normalizeModuleSlug(row.slug), row as ModuleRow)
  }

  const bySlug = new Map<string, OrganizationModuleStatus>()

  for (const item of (data ?? []) as OrganizationModuleRow[]) {
    const moduleRow = unwrapModule(item.modules)
    if (!moduleRow?.slug) continue

    const slug = normalizeModuleSlug(moduleRow.slug)
    const meta = moduleMetaBySlug.get(slug) ?? moduleRow
    const isCore = isCoreModuleSlug(slug) || Boolean(meta.is_core)
    const isProduct = isProductModuleSlug(slug)
    const isCapability = isCapabilityModuleSlug(slug)

    bySlug.set(slug, {
      id: meta.id,
      slug,
      name: meta.name,
      description: meta.description,
      enabled: isCore ? true : item.enabled,
      isCore,
      isProduct,
      isCapability,
      includeInCatalog:
        meta.include_in_catalog ?? (isProduct && !isCore && !isCapability),
      enabledByPlan: Boolean(item.enabled_by_plan),
      organizationModuleId: item.id,
    })
  }

  const catalogModules = PRODUCT_MODULE_SLUGS.map((slug) => {
    const existing = bySlug.get(slug)
    const meta = moduleMetaBySlug.get(slug)

    if (existing) return existing

    return {
      id: meta?.id ?? slug,
      slug,
      name: meta?.name ?? slug,
      description: meta?.description ?? null,
      enabled: false,
      isCore: false,
      isProduct: true,
      isCapability: false,
      includeInCatalog: meta?.include_in_catalog ?? true,
      enabledByPlan: false,
    } satisfies OrganizationModuleStatus
  })

  const capabilityModules = (allModules ?? [])
    .map((row) => normalizeModuleSlug(row.slug))
    .filter((slug) => isCapabilityModuleSlug(slug))
    .map((slug) => {
      const existing = bySlug.get(slug)
      const meta = moduleMetaBySlug.get(slug)
      if (existing) return existing

      return {
        id: meta?.id ?? slug,
        slug,
        name: meta?.name ?? slug,
        description: meta?.description ?? null,
        enabled: false,
        isCore: false,
        isProduct: false,
        isCapability: true,
        includeInCatalog: false,
        enabledByPlan: false,
      } satisfies OrganizationModuleStatus
    })

  const coreModules = CORE_MODULE_SLUGS.map((slug) => {
    const existing = bySlug.get(slug)
    const meta = moduleMetaBySlug.get(slug)

    return (
      existing ?? {
        id: meta?.id ?? slug,
        slug,
        name: meta?.name ?? slug,
        description: meta?.description ?? null,
        enabled: true,
        isCore: true,
        isProduct: false,
        isCapability: false,
        includeInCatalog: false,
        enabledByPlan: false,
      }
    )
  })

  return {
    bundleSlug: (org as { subscription_bundle_slug?: string | null } | null)
      ?.subscription_bundle_slug,
    bundles: SUBSCRIPTION_BUNDLES,
    coreModules,
    catalogModules,
    capabilityModules,
  }
}

export async function applySubscriptionBundleToOrganization(
  organizationId: string,
  bundleSlug: string
) {
  const bundle = getSubscriptionBundle(bundleSlug)
  if (!bundle) {
    throw new Error(`Unknown subscription bundle: ${bundleSlug}`)
  }

  const admin = createAdminClient()
  const moduleIdsBySlug = await loadModuleSlugMap(admin)
  const enabledSlugs = expandEnabledModuleSlugs(bundle.moduleSlugs)

  for (const productSlug of PRODUCT_MODULE_SLUGS) {
    const normalized = normalizeModuleSlug(productSlug)
    const moduleId = moduleIdsBySlug.get(normalized)
    if (!moduleId) continue

    const shouldEnable = enabledSlugs.has(normalized)
    await upsertOrganizationModule(
      admin,
      organizationId,
      moduleId,
      shouldEnable,
      false
    )
  }

  for (const slug of enabledSlugs) {
    if (!isCapabilityModuleSlug(slug)) continue
    const moduleId = moduleIdsBySlug.get(slug)
    if (!moduleId) continue

    await upsertOrganizationModule(admin, organizationId, moduleId, true, false)
  }

  for (const coreSlug of CORE_MODULE_SLUGS) {
    const moduleId = moduleIdsBySlug.get(coreSlug)
    if (!moduleId) continue
    await upsertOrganizationModule(admin, organizationId, moduleId, true, false)
  }

  const { error: orgError } = await admin
    .from("organizations")
    .update({ subscription_bundle_slug: bundleSlug })
    .eq("id", organizationId)

  if (orgError) {
    throw new Error(orgError.message)
  }

  return getOrganizationModuleAccess(organizationId)
}

export async function setOrganizationModuleEnabled(
  organizationId: string,
  moduleSlug: string,
  enabled: boolean
) {
  const slug = normalizeModuleSlug(moduleSlug)

  if (isCoreModuleSlug(slug)) {
    throw new Error("Core modules cannot be disabled.")
  }

  if (isCapabilityModuleSlug(slug)) {
    throw new Error(
      "Capability modules are managed automatically through their parent product module."
    )
  }

  const admin = createAdminClient()
  const moduleIdsBySlug = await loadModuleSlugMap(admin)
  const targets = getModuleToggleTargets(slug, enabled)

  for (const targetSlug of targets) {
    const moduleId = moduleIdsBySlug.get(targetSlug)
    if (!moduleId) continue

    await upsertOrganizationModule(
      admin,
      organizationId,
      moduleId,
      enabled,
      true
    )
  }

  const { error: orgError } = await admin
    .from("organizations")
    .update({ subscription_bundle_slug: null })
    .eq("id", organizationId)

  if (orgError) {
    throw new Error(orgError.message)
  }

  return getOrganizationModuleAccess(organizationId)
}

export async function syncImpliedModulesForOrganization(organizationId: string) {
  const admin = createAdminClient()
  const moduleIdsBySlug = await loadModuleSlugMap(admin)

  const { data, error } = await admin
    .from("organization_modules")
    .select(
      `
      enabled,
      modules ( slug )
    `
    )
    .eq("organization_id", organizationId)
    .eq("enabled", true)

  if (error) {
    throw new Error(error.message)
  }

  const enabledProductSlugs: string[] = []
  for (const row of data ?? []) {
    const moduleRow = unwrapModule(row.modules as OrganizationModuleRow["modules"])
    if (!moduleRow?.slug) continue
    const slug = normalizeModuleSlug(moduleRow.slug)
    if (isProductModuleSlug(slug)) {
      enabledProductSlugs.push(slug)
    }
  }

  const targetSlugs = expandEnabledModuleSlugs(enabledProductSlugs)

  for (const slug of targetSlugs) {
    if (!isCapabilityModuleSlug(slug)) continue
    const moduleId = moduleIdsBySlug.get(slug)
    if (!moduleId) continue

    await upsertOrganizationModule(admin, organizationId, moduleId, true, false)
  }
}
