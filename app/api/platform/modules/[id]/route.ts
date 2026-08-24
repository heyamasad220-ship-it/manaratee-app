import { NextResponse } from "next/server"

import { parseUsdToCents } from "@/lib/billing/money"
import {
  isCapabilityModuleSlug,
  isCoreModuleSlug,
  isProductModuleSlug,
  sanitizeIncludedCapabilitySlugs,
} from "@/lib/modules/module-catalog"
import { requirePlatformAdmin } from "@/lib/platform/require-platform-admin"

function serializeModule(module: {
  id: string
  slug: string
  name: string
  description: string | null
  monthly_price_cents: number | null
  is_active: boolean | null
  included_capability_slugs?: unknown
}) {
  return {
    id: module.id,
    slug: module.slug,
    name: module.name,
    description: module.description,
    monthlyPriceCents: Number(module.monthly_price_cents) || 0,
    isActive: module.is_active !== false,
    includedCapabilitySlugs: sanitizeIncludedCapabilitySlugs(
      module.included_capability_slugs
    ),
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const { id } = await params
    const body = await request.json()

    const { data: existing, error: existingError } = await auth.context.admin
      .from("modules")
      .select("id, slug, include_in_catalog")
      .eq("id", id)
      .maybeSingle()

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: "Module not found." }, { status: 404 })
    }
    if (
      isCoreModuleSlug(existing.slug) ||
      isCapabilityModuleSlug(existing.slug)
    ) {
      return NextResponse.json(
        { error: "Core and capability modules are not edited here." },
        { status: 400 }
      )
    }
    if (
      !isProductModuleSlug(existing.slug) &&
      existing.include_in_catalog !== true
    ) {
      return NextResponse.json(
        { error: "Only product catalog modules can be priced and edited here." },
        { status: 400 }
      )
    }

    const updates: Record<string, unknown> = {}
    if (typeof body.name === "string") updates.name = body.name.trim()
    if (body.description !== undefined) {
      updates.description =
        body.description == null ? null : String(body.description)
    }
    if (body.isActive !== undefined) updates.is_active = Boolean(body.isActive)

    if (body.monthlyPriceCents !== undefined) {
      const cents = Number(body.monthlyPriceCents)
      if (!Number.isInteger(cents) || cents < 0) {
        return NextResponse.json(
          { error: "monthlyPriceCents must be a non-negative integer." },
          { status: 400 }
        )
      }
      updates.monthly_price_cents = cents
    } else if (typeof body.monthlyPrice === "string") {
      const cents = parseUsdToCents(body.monthlyPrice)
      if (cents == null) {
        return NextResponse.json(
          { error: "monthlyPrice must be a valid dollar amount." },
          { status: 400 }
        )
      }
      updates.monthly_price_cents = cents
    }

    if (body.includedCapabilitySlugs !== undefined) {
      updates.included_capability_slugs = sanitizeIncludedCapabilitySlugs(
        body.includedCapabilitySlugs
      )
    }

    const selectWithCapabilities =
      "id, slug, name, description, monthly_price_cents, is_active, included_capability_slugs"
    const selectWithoutCapabilities =
      "id, slug, name, description, monthly_price_cents, is_active"

    let { data: module, error } = await auth.context.admin
      .from("modules")
      .update(updates)
      .eq("id", id)
      .select(selectWithCapabilities)
      .single()

    if (error && /included_capability_slugs/i.test(error.message)) {
      delete updates.included_capability_slugs
      const retry = await auth.context.admin
        .from("modules")
        .update(updates)
        .eq("id", id)
        .select(selectWithoutCapabilities)
        .single()
      module = retry.data
      error = retry.error
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      module: serializeModule(module),
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update module."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
