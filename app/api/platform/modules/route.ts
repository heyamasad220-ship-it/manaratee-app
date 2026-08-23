import { NextResponse } from "next/server"

import {
  loadDiscountRules,
  loadProductModuleCatalog,
} from "@/lib/billing/organization-subscription-service"
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
    return NextResponse.json({ modules, discountRules })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load modules."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
