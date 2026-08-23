import { NextResponse } from "next/server"

import {
  loadOrganizationSubscriptionView,
  saveOrganizationProductSubscription,
} from "@/lib/billing/organization-subscription-service"
import { requirePlatformAdmin } from "@/lib/platform/require-platform-admin"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const { organizationId } = await params
    const view = await loadOrganizationSubscriptionView(organizationId)
    return NextResponse.json(view)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load subscription."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const { organizationId } = await params
    const body = await request.json()
    const selectedProductSlugs = Array.isArray(body.selectedProductSlugs)
      ? body.selectedProductSlugs.map((slug: unknown) => String(slug))
      : []

    let customMonthlyCents: number | null | undefined = undefined
    if (body.customMonthlyCents === null || body.clearCustomPrice === true) {
      customMonthlyCents = null
    } else if (body.customMonthlyCents !== undefined) {
      const cents = Number(body.customMonthlyCents)
      if (!Number.isInteger(cents) || cents < 0) {
        return NextResponse.json(
          { error: "customMonthlyCents must be a non-negative integer." },
          { status: 400 }
        )
      }
      customMonthlyCents = cents
    }

    const result = await saveOrganizationProductSubscription({
      organizationId,
      selectedProductSlugs,
      customMonthlyCents,
      isPriceLocked:
        body.isPriceLocked === undefined ? undefined : Boolean(body.isPriceLocked),
      bundleSlug: body.bundleSlug == null ? null : String(body.bundleSlug),
      actorUserId: auth.context.userId,
    })

    const view = await loadOrganizationSubscriptionView(organizationId)
    return NextResponse.json({ success: true, ...result, ...view })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save subscription."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
