import type { SupabaseClient } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/server"

export async function linkVendorContactsForCurrentUser(
  supabase?: SupabaseClient
): Promise<number> {
  const client = supabase ?? (await createClient())
  const {
    data: { user },
  } = await client.auth.getUser()

  if (!user) {
    return 0
  }

  const { data, error } = await client.rpc("link_contacts_to_auth_user")

  if (error) {
    if (error.code === "42883" || error.message?.includes("link_contacts_to_auth_user")) {
      return linkVendorContactsByEmailFallback(client, user.id, user.email)
    }
    console.error("link_contacts_to_auth_user:", error)
    return 0
  }

  return typeof data === "number" ? data : 0
}

async function linkVendorContactsByEmailFallback(
  supabase: SupabaseClient,
  authUserId: string,
  email: string | undefined
): Promise<number> {
  const normalizedEmail = email?.trim().toLowerCase()
  if (!normalizedEmail) {
    return 0
  }

  const { data: matches, error: selectError } = await supabase
    .from("contacts")
    .select("id")
    .is("auth_user_id", null)
    .ilike("email", normalizedEmail)

  if (selectError || !matches?.length) {
    return 0
  }

  let linked = 0
  for (const row of matches) {
    const { error } = await supabase
      .from("contacts")
      .update({ auth_user_id: authUserId })
      .eq("id", row.id as string)
      .is("auth_user_id", null)

    if (!error) {
      linked += 1
    }
  }

  return linked
}

export async function attachAuthUserToContactIfLoggedIn(input: {
  supabase: SupabaseClient
  contactId: string
  authUserId?: string | null
}) {
  if (!input.authUserId) {
    return
  }

  await input.supabase
    .from("contacts")
    .update({ auth_user_id: input.authUserId })
    .eq("id", input.contactId)
    .is("auth_user_id", null)
}
