import type { SupabaseClient, User } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/client"

function isAuthLockError(error: unknown) {
  if (!error) return false

  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    if (error.name === "AbortError") return true
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof (error as { message: unknown }).message === "string"
        ? (error as { message: string }).message
        : String(error)

  return (
    /lock/i.test(message) &&
    (/steal/i.test(message) || /released/i.test(message) || /broken/i.test(message))
  )
}

/**
 * Resolve the current browser user without surfacing Navigator Lock races
 * when multiple components call auth at once (Strict Mode / parallel mounts).
 */
export async function getBrowserAuthUser(
  client?: SupabaseClient
): Promise<User | null> {
  const supabase = client ?? createClient()

  try {
    const { data, error } = await supabase.auth.getUser()
    if (!error && data.user) {
      return data.user
    }
    if (error && !isAuthLockError(error)) {
      return null
    }
  } catch (error) {
    if (!isAuthLockError(error)) {
      return null
    }
  }

  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.user ?? null
  } catch {
    return null
  }
}
