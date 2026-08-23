import { NextResponse } from "next/server"

import { loadDiscountRules } from "@/lib/billing/organization-subscription-service"
import { requirePlatformAdmin } from "@/lib/platform/require-platform-admin"

export async function GET() {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const discountRules = await loadDiscountRules()
    return NextResponse.json({ discountRules })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load discount rules."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const body = await request.json()
    const rows = Array.isArray(body?.discountRules) ? body.discountRules : []
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "discountRules is required." },
        { status: 400 }
      )
    }

    const payload = rows.map((row: Record<string, unknown>) => {
      const moduleCount = Number(row.moduleCount)
      const discountPercent = Number(row.discountPercent)
      if (!Number.isInteger(moduleCount) || moduleCount < 1 || moduleCount > 6) {
        throw new Error("moduleCount must be an integer from 1 to 6.")
      }
      if (
        !Number.isInteger(discountPercent) ||
        discountPercent < 0 ||
        discountPercent > 100
      ) {
        throw new Error("discountPercent must be an integer from 0 to 100.")
      }
      return {
        module_count: moduleCount,
        discount_percent: discountPercent,
        is_active: row.isActive !== false,
        updated_at: new Date().toISOString(),
      }
    })

    const { error } = await auth.context.admin
      .from("module_discount_rules")
      .upsert(payload, { onConflict: "module_count" })

    if (error) throw new Error(error.message)

    const discountRules = await loadDiscountRules()
    return NextResponse.json({ success: true, discountRules })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save discount rules."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
