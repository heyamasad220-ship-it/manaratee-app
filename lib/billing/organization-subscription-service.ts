import { writeOrganizationAuditLog } from "@/lib/audit/organization-audit-log"
import {
  calculateModuleSubscriptionQuote,
  type ModuleDiscountRule,
  type PricedProductModule,
  type SubscriptionQuote,
} from "@/lib/billing/module-subscription-pricing"
import {
  filterProductModuleSlugs,
  isCapabilityModuleSlug,
  isCoreModuleSlug,
  isProductModuleSlug,
  sanitizeIncludedCapabilitySlugs,
  IMPLIED_MODULE_SLUGS,
} from "@/lib/modules/module-catalog"
import {
  getOrganizationModuleAccess,
  replaceOrganizationProductModules,
} from "@/lib/modules/organization-module-access"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export type OrganizationSubscriptionSnapshot = {
  organizationId: string
  selectedProductSlugs: string[]
  moduleSubtotalCents: number
  discountPercent: number
  discountAmountCents: number
  calculatedMonthlyCents: number
  customMonthlyCents: number | null
  billedMonthlyCents: number
  isPriceLocked: boolean
  billingInterval: "monthly" | "annual"
  billingStatus: string
  stripeSubscriptionId: string | null
  nextBillingDate: string | null
  updatedAt: string | null
}

export type CatalogModuleRow = {
  id: string
  slug: string
  name: string
  description: string | null
  monthlyPriceCents: number
  isActive: boolean
  includedCapabilitySlugs: string[]
}

function normalizeInterval(value: unknown): "monthly" | "annual" {
  return String(value || "").toLowerCase() === "annual" ? "annual" : "monthly"
}

function centsFromLegacyDollars(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.round(n * 100)
}

function rowToCatalogModule(row: Record<string, unknown>): CatalogModuleRow | null {
  const slug = String(row.slug || "").trim()
  if (!slug || isCoreModuleSlug(slug) || isCapabilityModuleSlug(slug)) return null
  if (!isProductModuleSlug(slug) && row.include_in_catalog !== true) return null
  const monthlyPriceCents =
    Number(row.monthly_price_cents) ||
    centsFromLegacyDollars(row.price_monthly ?? row.monthly_price) ||
    0
  const includedCapabilitySlugs =
    row.included_capability_slugs == null
      ? [...(IMPLIED_MODULE_SLUGS[slug] ?? [])]
      : sanitizeIncludedCapabilitySlugs(row.included_capability_slugs)
  return {
    id: String(row.id),
    slug,
    name: String(row.name || slug),
    description: row.description == null ? null : String(row.description),
    monthlyPriceCents: Math.max(0, Math.round(monthlyPriceCents)),
    isActive: row.is_active !== false,
    includedCapabilitySlugs,
  }
}

export async function loadProductModuleCatalog(): Promise<CatalogModuleRow[]> {
  const supabase = createServiceRoleClient()
  // monthly_price_cents is the source of truth. included_capability_slugs is
  // added by SQL 275; retry without it so the catalog still loads beforehand.
  const withCapabilities =
    "id, slug, name, description, monthly_price_cents, is_active, include_in_catalog, included_capability_slugs"
  const withoutCapabilities =
    "id, slug, name, description, monthly_price_cents, is_active, include_in_catalog"

  let { data, error } = await supabase
    .from("modules")
    .select(withCapabilities)
    .order("name", { ascending: true })

  if (error && /included_capability_slugs/i.test(error.message)) {
    const retry = await supabase
      .from("modules")
      .select(withoutCapabilities)
      .order("name", { ascending: true })
    data = retry.data
    error = retry.error
  }

  if (error) throw new Error(error.message)
  return ((data || []) as Record<string, unknown>[])
    .map(rowToCatalogModule)
    .filter((row): row is CatalogModuleRow => Boolean(row))
}

export function catalogImpliedCapabilityMap(
  catalog: CatalogModuleRow[]
): Record<string, readonly string[]> {
  return Object.fromEntries(
    catalog.map((row) => [row.slug, row.includedCapabilitySlugs])
  )
}

export async function loadDiscountRules(): Promise<ModuleDiscountRule[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from("module_discount_rules")
    .select("module_count, discount_percent, is_active")
    .order("module_count", { ascending: true })

  if (error) throw new Error(error.message)
  return (data || []).map((row) => ({
    moduleCount: Number(row.module_count) || 0,
    discountPercent: Number(row.discount_percent) || 0,
    isActive: row.is_active !== false,
  }))
}

export function catalogToPricedModules(
  catalog: CatalogModuleRow[]
): PricedProductModule[] {
  return catalog.map((row) => ({
    slug: row.slug,
    name: row.name,
    description: row.description,
    monthlyPriceCents: row.monthlyPriceCents,
    isActive: row.isActive,
  }))
}

export async function loadOrganizationSubscription(
  organizationId: string
): Promise<OrganizationSubscriptionSnapshot | null> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from("organization_subscriptions")
    .select(
      "organization_id, selected_product_slugs, module_subtotal_cents, discount_percent, discount_amount_cents, calculated_monthly_cents, custom_monthly_cents, billed_monthly_cents, is_price_locked, billing_interval, billing_status, stripe_subscription_id, next_billing_date, updated_at"
    )
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  return {
    organizationId: String(data.organization_id),
    selectedProductSlugs: filterProductModuleSlugs(data.selected_product_slugs || []),
    moduleSubtotalCents: Number(data.module_subtotal_cents) || 0,
    discountPercent: Number(data.discount_percent) || 0,
    discountAmountCents: Number(data.discount_amount_cents) || 0,
    calculatedMonthlyCents: Number(data.calculated_monthly_cents) || 0,
    customMonthlyCents:
      data.custom_monthly_cents == null ? null : Number(data.custom_monthly_cents),
    billedMonthlyCents: Number(data.billed_monthly_cents) || 0,
    isPriceLocked: Boolean(data.is_price_locked),
    billingInterval: normalizeInterval(data.billing_interval),
    billingStatus: String(data.billing_status || "active"),
    stripeSubscriptionId: data.stripe_subscription_id
      ? String(data.stripe_subscription_id)
      : null,
    nextBillingDate: data.next_billing_date ? String(data.next_billing_date) : null,
    updatedAt: data.updated_at ? String(data.updated_at) : null,
  }
}

export async function loadEnabledProductSlugs(
  organizationId: string
): Promise<string[]> {
  const access = await getOrganizationModuleAccess(organizationId)
  return filterProductModuleSlugs(
    access.catalogModules.filter((item) => item.enabled).map((item) => item.slug)
  )
}

export function quoteSelectedModules(input: {
  selectedProductSlugs: Iterable<string>
  catalog: CatalogModuleRow[]
  discountRules: ModuleDiscountRule[]
  customMonthlyCents?: number | null
  isPriceLocked?: boolean
  lockedMonthlyCents?: number | null
}): SubscriptionQuote {
  return calculateModuleSubscriptionQuote({
    selectedSlugs: filterProductModuleSlugs(input.selectedProductSlugs),
    productModules: catalogToPricedModules(input.catalog),
    discountRules: input.discountRules,
    customMonthlyCents: input.customMonthlyCents ?? null,
    isPriceLocked: input.isPriceLocked,
    lockedMonthlyCents: input.lockedMonthlyCents ?? null,
  })
}

function assertSelectableModules(input: {
  selectedProductSlugs: string[]
  previouslySelected: string[]
  catalog: CatalogModuleRow[]
}) {
  const previously = new Set(input.previouslySelected)
  for (const slug of input.selectedProductSlugs) {
    const module = input.catalog.find((item) => item.slug === slug)
    if (!module) {
      throw new Error(`Unknown product module: ${slug}`)
    }
    if (!module.isActive && !previously.has(slug)) {
      throw new Error(
        `${module.name} is inactive and cannot be added to a subscription.`
      )
    }
  }
}

export async function persistOrganizationSubscriptionSnapshot(input: {
  organizationId: string
  selectedProductSlugs: string[]
  customMonthlyCents?: number | null
  isPriceLocked?: boolean
  billingInterval?: "monthly" | "annual"
  actorUserId?: string | null
  reason?: string
}): Promise<OrganizationSubscriptionSnapshot> {
  const previous = await loadOrganizationSubscription(input.organizationId)
  const catalog = await loadProductModuleCatalog()
  const rules = await loadDiscountRules()
  const selected = filterProductModuleSlugs(input.selectedProductSlugs)
  const previouslySelected =
    previous?.selectedProductSlugs.length
      ? previous.selectedProductSlugs
      : await loadEnabledProductSlugs(input.organizationId)

  assertSelectableModules({
    selectedProductSlugs: selected,
    previouslySelected,
    catalog,
  })

  const keepLocked =
    input.isPriceLocked === undefined
      ? Boolean(previous?.isPriceLocked)
      : Boolean(input.isPriceLocked)
  const customCents =
    input.customMonthlyCents === undefined
      ? previous?.customMonthlyCents ?? null
      : input.customMonthlyCents

  const quote = quoteSelectedModules({
    selectedProductSlugs: selected,
    catalog,
    discountRules: rules,
    customMonthlyCents: customCents,
    isPriceLocked: keepLocked,
    lockedMonthlyCents: previous?.billedMonthlyCents ?? null,
  })

  const payload = {
    organization_id: input.organizationId,
    selected_product_slugs: quote.selectedSlugs,
    module_subtotal_cents: quote.moduleSubtotalCents,
    discount_percent: quote.discountPercent,
    discount_amount_cents: quote.discountAmountCents,
    calculated_monthly_cents: quote.calculatedMonthlyCents,
    custom_monthly_cents: quote.customMonthlyCents,
    billed_monthly_cents: quote.billedMonthlyCents,
    is_price_locked: quote.isPriceLocked,
    billing_interval: input.billingInterval || previous?.billingInterval || "monthly",
    updated_at: new Date().toISOString(),
  }

  const supabase = createServiceRoleClient()
  const { error } = await supabase.from("organization_subscriptions").upsert(payload, {
    onConflict: "organization_id",
  })
  if (error) throw new Error(error.message)

  // TODO(stripe-platform-billing): sync billed_monthly_cents to Stripe subscription items.
  // Do not create/cancel Stripe objects here. organizations.stripe_customer_id is unused until
  // platform SaaS billing is implemented.

  const added = quote.selectedSlugs.filter((slug) => !previouslySelected.includes(slug))
  const removed = previouslySelected.filter((slug) => !quote.selectedSlugs.includes(slug))

  await writeOrganizationAuditLog({
    organizationId: input.organizationId,
    category: "financial",
    action: "organization.subscription.updated",
    actorUserId: input.actorUserId,
    targetType: "organization_subscription",
    targetId: input.organizationId,
    targetLabel: "Organization subscription",
    summary: "Updated organization module subscription",
    metadata: {
      modules_added: added,
      modules_removed: removed,
      selected_product_slugs: quote.selectedSlugs,
      previous_billed_monthly_cents: previous?.billedMonthlyCents ?? null,
      billed_monthly_cents: quote.billedMonthlyCents,
      calculated_monthly_cents: quote.calculatedMonthlyCents,
      discount_percent: quote.discountPercent,
      discount_amount_cents: quote.discountAmountCents,
      custom_monthly_cents: quote.customMonthlyCents,
      is_price_locked: quote.isPriceLocked,
      reason: input.reason || null,
    },
  })

  const saved = await loadOrganizationSubscription(input.organizationId)
  if (!saved) throw new Error("Failed to load saved subscription.")
  return saved
}

export async function saveOrganizationProductSubscription(input: {
  organizationId: string
  selectedProductSlugs: string[]
  customMonthlyCents?: number | null
  isPriceLocked?: boolean
  billingInterval?: "monthly" | "annual"
  bundleSlug?: string | null
  actorUserId?: string | null
}): Promise<{
  snapshot: OrganizationSubscriptionSnapshot
  access: Awaited<ReturnType<typeof replaceOrganizationProductModules>>
}> {
  const catalog = await loadProductModuleCatalog()
  const previouslySelected = await loadEnabledProductSlugs(input.organizationId)
  assertSelectableModules({
    selectedProductSlugs: filterProductModuleSlugs(input.selectedProductSlugs),
    previouslySelected,
    catalog,
  })

  const access = await replaceOrganizationProductModules(
    input.organizationId,
    input.selectedProductSlugs,
    { bundleSlug: input.bundleSlug ?? null }
  )

  const snapshot = await persistOrganizationSubscriptionSnapshot({
    ...input,
    reason: input.bundleSlug
      ? `super_admin_bundle:${input.bundleSlug}`
      : "super_admin_module_selection",
  })

  return { snapshot, access }
}

export async function persistSubscriptionFromCurrentModules(input: {
  organizationId: string
  actorUserId?: string | null
  reason?: string
}): Promise<OrganizationSubscriptionSnapshot> {
  const selectedProductSlugs = await loadEnabledProductSlugs(input.organizationId)
  return persistOrganizationSubscriptionSnapshot({
    organizationId: input.organizationId,
    selectedProductSlugs,
    actorUserId: input.actorUserId,
    reason: input.reason || "module_toggle",
  })
}

export async function loadOrganizationSubscriptionView(organizationId: string) {
  const [catalog, discountRules, snapshot, access] = await Promise.all([
    loadProductModuleCatalog(),
    loadDiscountRules(),
    loadOrganizationSubscription(organizationId),
    getOrganizationModuleAccess(organizationId),
  ])

  const selectedProductSlugs =
    snapshot?.selectedProductSlugs.length
      ? snapshot.selectedProductSlugs
      : filterProductModuleSlugs(
          access.catalogModules.filter((item) => item.enabled).map((item) => item.slug)
        )

  const quote = quoteSelectedModules({
    selectedProductSlugs,
    catalog,
    discountRules,
    customMonthlyCents: snapshot?.customMonthlyCents ?? null,
    isPriceLocked: snapshot?.isPriceLocked,
    lockedMonthlyCents: snapshot?.billedMonthlyCents ?? null,
  })

  return {
    catalog,
    discountRules,
    snapshot,
    access,
    selectedProductSlugs,
    quote,
  }
}
