import { NextResponse } from "next/server"

import {
  createPlatformPlan,
  listActiveModules,
  listPlatformPlans,
} from "@/lib/platform/platform-plans"
import { requirePlatformAdmin } from "@/lib/platform/require-platform-admin"

export async function GET() {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const [plans, modules] = await Promise.all([
      listPlatformPlans(auth.context.admin),
      listActiveModules(auth.context.admin),
    ])

    return NextResponse.json({ plans, modules })
  } catch (error) {
    console.error("Platform plans GET failed:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load subscription plans.",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const body = await request.json()
    const name = String(body?.name ?? "").trim()
    const monthlyPrice = Number(body?.monthlyPrice ?? 0)
    const memberLimitRaw = body?.memberLimit
    const memberLimit =
      memberLimitRaw === null || memberLimitRaw === undefined || memberLimitRaw === ""
        ? null
        : Number(memberLimitRaw)

    if (!name) {
      return NextResponse.json({ error: "Plan name is required." }, { status: 400 })
    }

    await createPlatformPlan({
      admin: auth.context.admin,
      name,
      monthlyPrice,
      memberLimit: Number.isFinite(memberLimit as number) ? memberLimit : null,
    })

    const plans = await listPlatformPlans(auth.context.admin)
    return NextResponse.json({ success: true, plans })
  } catch (error) {
    console.error("Platform plans POST failed:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create subscription plan.",
      },
      { status: 500 }
    )
  }
}
