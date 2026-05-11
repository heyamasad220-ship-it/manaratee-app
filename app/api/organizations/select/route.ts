import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const organizationId = body.organizationId

    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      )
    }

    const response = NextResponse.json({ success: true })

    response.cookies.set("selected_organization_id", organizationId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    })

    return response
  } catch (error) {
    console.error("Select organization route error:", error)

    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    )
  }
}