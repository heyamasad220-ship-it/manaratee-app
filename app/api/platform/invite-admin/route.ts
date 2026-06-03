import { NextResponse } from "next/server"

import {
  inviteOrganizationMember,
  resolveAppUrlFromRequest,
} from "@/lib/organizations/invite-organization-member"
import { requirePlatformAdmin } from "@/lib/platform/require-platform-admin"

export async function POST(request: Request) {
  try {
    const auth = await requirePlatformAdmin()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const email = String(body.email || "")
      .trim()
      .toLowerCase()
    const organizationId = String(body.organizationId || "").trim()
    const organizationName = body.organizationName
      ? String(body.organizationName).trim()
      : null
    const roleId = body.roleId ? String(body.roleId).trim() : null
    const firstName = body.firstName ? String(body.firstName).trim() : ""
    const lastName = body.lastName ? String(body.lastName).trim() : ""

    if (!email) {
      return NextResponse.json(
        { error: "Admin email is required." },
        { status: 400 }
      )
    }

    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization ID is required." },
        { status: 400 }
      )
    }

    const result = await inviteOrganizationMember(auth.context.admin, {
      email,
      organizationId,
      roleId,
      firstName,
      lastName,
      organizationName,
      inviterSystemRole: "admin",
      staffOnly: true,
      appUrl: resolveAppUrlFromRequest(request),
    })

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          details: result.details,
          fix: result.fix,
        },
        { status: result.status }
      )
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      user: result.user,
    })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to invite admin.",
      },
      { status: 500 }
    )
  }
}
