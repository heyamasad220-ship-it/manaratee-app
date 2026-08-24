import { NextResponse } from "next/server"

import { parseUsdToCents } from "@/lib/billing/money"
import {
  loadDiscountRules,
  loadProductModuleCatalog,
} from "@/lib/billing/organization-subscription-service"
import {
  isCapabilityModuleSlug,
  isCoreModuleSlug,
  isValidProductModuleSlug,
  sanitizeIncludedCapabilitySlugs,
  slugifyProductModuleSlug,
} from "@/lib/modules/module-catalog"
import { catalogCapabilityCheckboxItems } from "@/lib/modules/staff-module-labels"
import { requirePlatformAdmin } from "@/lib/platform/require-platform-admin"

export async function GET() {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const [modules, discountRules] = await Promise.all([
      loadProductModuleCatalog(),
      loadDiscountRules(),
    ])
    return NextResponse.json({
      modules,
      discountRules,
      capabilities: catalogCapabilityCheckboxItems(),
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load modules."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const body = await request.json()
    const name = String(body.name || "").trim()
    if (!name) {
      return NextResponse.json({ error: "Module name is required." }, { status: 400 })
    }

    const slug = slugifyProductModuleSlug(
      typeof body.slug === "string" && body.slug.trim() ? body.slug : name
    )
    if (!isValidProductModuleSlug(slug)) {
      return NextResponse.json(
        { error: "Slug must start with a letter and use lowercase letters, numbers, and hyphens." },
        { status: 400 }
      )
    }
    if (isCoreModuleSlug(slug) || isCapabilityModuleSlug(slug)) {
      return NextResponse.json(
        { error: "That slug is reserved for a core or included capability module." },
        { status: 400 }
      )
    }

    let cents: number | null = null
    if (body.monthlyPriceCents !== undefined) {
      cents = Number(body.monthlyPriceCents)
    } else if (typeof body.monthlyPrice === "string") {
      cents = parseUsdToCents(body.monthlyPrice)
    } else {
      cents = 0
    }
    if (cents == null || !Number.isInteger(cents) || cents < 0) {
      return NextResponse.json(
        { error: "Enter a valid monthly price such as 149.00." },
        { status: 400 }
      )
    }

    const includedCapabilitySlugs = sanitizeIncludedCapabilitySlugs(
      body.includedCapabilitySlugs
    )
    const description =
      body.description == null ? null : String(body.description).trim() || null

    const { data: existing, error: existingError } = await auth.context.admin
      .from("modules")
      .select("id")
      .eq("slug", slug)
      .maybeSingle()

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 })
    }
    if (existing) {
      return NextResponse.json(
        { error: "A module with that slug already exists." },
        { status: 400 }
      )
    }

    const insertPayload: Record<string, unknown> = {
      code: slug,
      name,
      slug,
      description,
      route: `/${slug}`,
      icon_name: "Boxes",
      group_name: "Custom",
      sort_order: 200,
      is_core: false,
      is_active: true,
      default_enabled: false,
      include_in_catalog: true,
      monthly_price_cents: cents,
      included_capability_slugs: includedCapabilitySlugs,
    }

    let { data: created, error } = await auth.context.admin
      .from("modules")
      .insert(insertPayload)
      .select(
        "id, slug, name, description, monthly_price_cents, is_active, included_capability_slugs"
      )
      .single()

    if (error && /included_capability_slugs/i.test(error.message)) {
      delete insertPayload.included_capability_slugs
      const retry = await auth.context.admin
        .from("modules")
        .insert(insertPayload)
        .select("id, slug, name, description, monthly_price_cents, is_active")
        .single()
      created = retry.data
      error = retry.error
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      module: {
        id: created.id,
        slug: created.slug,
        name: created.name,
        description: created.description,
        monthlyPriceCents: Number(created.monthly_price_cents) || 0,
        isActive: created.is_active !== false,
        includedCapabilitySlugs: sanitizeIncludedCapabilitySlugs(
          created.included_capability_slugs
        ),
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create module."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
