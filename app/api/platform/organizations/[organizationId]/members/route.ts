import { NextResponse } from "next/server"

import {
  inviteOrganizationMember,
  listOrganizationMembers,
  resolveAppUrlFromRequest,
} from "@/lib/organizations/invite-organization-member"
import { requirePlatformAdmin } from "@/lib/platform/require-platform-admin"

type RouteContext = {
  params: Promise<{ organizationId: string }>
}

export async function GET(_req: Request, context: RouteContext) {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { organizationId } = await context.params

  try {
    const payload = await listOrganizationMembers(
      auth.context.admin,
      organizationId,
      { staffOnly: true }
    )

    return NextResponse.json(payload)
  } catch (error) {
    console.error("Platform organization members GET failed:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load organization members.",
      },
      { status: 500 }
    )
  }
}

export async function POST(req: Request, context: RouteContext) {
  const auth = await requirePlatformAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { organizationId } = await context.params

  try {
    const body = await req.json()
    const email = String(body.email || "")
      .trim()
      .toLowerCase()
    const roleId = body.roleId ? String(body.roleId).trim() : null
    const roleName = body.roleName ? String(body.roleName).trim() : null
    const firstName = body.firstName ? String(body.firstName).trim() : ""
    const lastName = body.lastName ? String(body.lastName).trim() : ""
    const organizationName = body.organizationName
      ? String(body.organizationName).trim()
      : null

    const result = await inviteOrganizationMember(auth.context.admin, {
      email,
      organizationId,
      roleId,
      roleName,
      firstName,
      lastName,
      organizationName,
      inviterSystemRole: "admin",
      staffOnly: true,
      appUrl: resolveAppUrlFromRequest(req),
    })

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          details: result.details,
          hint: result.hint,
          code: result.code,
          fix: result.fix,
          attemptedRoles: result.attemptedRoles,
        },
        { status: result.status }
      )
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      user: result.user,
      membership: result.membership,
      existingUser: result.existingUser,
      emailSent: result.emailSent,
      memberSystemRole: result.memberSystemRole,
    })
  } catch (error) {
    console.error("Platform organization invite failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Unexpected invite failure.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
