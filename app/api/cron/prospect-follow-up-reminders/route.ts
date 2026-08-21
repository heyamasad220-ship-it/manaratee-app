import { NextResponse } from "next/server"

import { runProspectFollowUpReminderJob } from "@/lib/donations/prospect-follow-up-reminder-job"

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
    const result = await runProspectFollowUpReminderJob()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("prospect-follow-up-reminders cron failed:", error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Reminder job failed",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  return GET(request)
}
