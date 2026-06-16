import { NextResponse } from "next/server"

import { runVenueRentalHoldExpiryJob } from "@/lib/bookings/venue-rental-hold-expiry"

export const dynamic = "force-dynamic"

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim()

  if (!cronSecret) {
    return process.env.NODE_ENV === "development"
  }

  const authHeader = request.headers.get("authorization")
  return authHeader === `Bearer ${cronSecret}`
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await runVenueRentalHoldExpiryJob()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("venue-rental-hold-expiry cron failed:", error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Hold expiry job failed",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  return GET(request)
}
