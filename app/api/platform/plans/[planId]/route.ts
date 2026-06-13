import { NextResponse } from "next/server"

import { listPlatformPlans, updatePlatformPlan } from "@/lib/platform/platform-plans"
import { requirePlatformAdmin } from "@/lib/platform/require-platform-admin"

type RouteContext = {
  params: Promise<{ planId: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const { planId } = await context.params
    const body = await request.json()

    const name = String(body?.name ?? "").trim()
    if (!name) {
      return NextResponse.json({ error: "Plan name is required." }, { status: 400 })
    }

    const memberLimitRaw = body?.memberLimit
    const eventLimitRaw = body?.eventLimit

    await updatePlatformPlan({
      admin: auth.context.admin,
      planId,
      name,
      description: body?.description ? String(body.description) : null,
      monthlyPrice: Number(body?.monthlyPrice ?? 0),
      yearlyPrice: Number(body?.yearlyPrice ?? 0),
      memberLimit:
        memberLimitRaw === null || memberLimitRaw === undefined || memberLimitRaw === ""
          ? null
          : Number(memberLimitRaw),
      eventLimit:
        eventLimitRaw === null || eventLimitRaw === undefined || eventLimitRaw === ""
          ? null
          : Number(eventLimitRaw),
      isPopular: Boolean(body?.isPopular),
      moduleSlugs: Array.isArray(body?.moduleSlugs)
        ? body.moduleSlugs.map((slug: unknown) => String(slug))
        : [],
    })

    const plans = await listPlatformPlans(auth.context.admin)
    return NextResponse.json({ success: true, plans })
  } catch (error) {
    console.error("Platform plan PATCH failed:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update subscription plan.",
      },
      { status: 500 }
    )
  }
}
