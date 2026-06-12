import { NextResponse } from "next/server"

import { getVendorHubDashboardMetrics } from "@/lib/vendor-hub/vendor-hub-event-queries"
import { requireVendorHubView } from "@/lib/vendor-hub/vendor-hub-permissions"

export async function GET(request: Request) {
  await requireVendorHubView()

  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get("eventId")

  const metrics = await getVendorHubDashboardMetrics(eventId)

  return NextResponse.json(metrics)
}
