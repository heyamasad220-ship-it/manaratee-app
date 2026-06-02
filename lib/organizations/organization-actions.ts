"use server"

import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
}

export async function selectOrganization(organizationId: string) {
  const trimmedId = organizationId?.trim()

  if (!trimmedId) {
    throw new Error("Organization ID is required")
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error("Not authenticated")
  }

  let membershipQuery = supabase
    .from("organization_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("organization_id", trimmedId)
    .limit(1)

  const { data: activeMembership, error: activeMembershipError } =
    await membershipQuery.eq("status", "active").maybeSingle()

  if (activeMembershipError && activeMembershipError.code !== "42703") {
    throw new Error(activeMembershipError.message || "Could not verify organization membership")
  }

  if (!activeMembership) {
    const { data: membership, error: membershipError } = await supabase
      .from("organization_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("organization_id", trimmedId)
      .maybeSingle()

    if (membershipError) {
      throw new Error(membershipError.message || "Could not verify organization membership")
    }

    if (!membership) {
      throw new Error("You are not a member of this organization")
    }
  }

  const cookieStore = await cookies()
  cookieStore.set("selected_organization_id", trimmedId, cookieOptions)

  return { success: true }
}
