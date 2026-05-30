"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export async function switchOrganizationAction(formData: FormData) {
  const organizationId = String(formData.get("organization_id") || "")

  if (!organizationId) {
    redirect("/customer/dashboard")
  }

  const supabase = await createClient()

  const { data: organizations, error } = await supabase.rpc(
    "get_my_organizations"
  )

  if (error) {
    throw new Error(error.message)
  }

  const allowed = organizations?.some(
    (org: any) => org.organization_id === organizationId
  )

  if (!allowed) {
    redirect("/unauthorized")
  }

  const cookieStore = await cookies()

  cookieStore.set("active_organization_id", organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  })

  redirect("/customer/dashboard")
}