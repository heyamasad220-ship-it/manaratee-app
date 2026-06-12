import type { SupabaseClient, User } from "@supabase/supabase-js"

import { getOrgUserSupportSession } from "@/lib/organizations/org-user-access"
import { getServiceRoleClient } from "@/lib/platform/require-platform-admin"
import { createClient } from "@/lib/supabase/server"

export type CustomerPortalSession = {
  authenticatedUser: User
  effectiveUserId: string
  isSupportSession: boolean
  supportOrganizationId: string | null
}

export type CustomerPortalClients = {
  session: CustomerPortalSession
  dataClient: SupabaseClient
  actionClient: SupabaseClient
  effectiveUserId: string
}

export async function resolveCustomerPortalSession(): Promise<CustomerPortalSession | null> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  const supportSession = await getOrgUserSupportSession()

  if (supportSession) {
    return {
      authenticatedUser: user,
      effectiveUserId: supportSession.actingUserId,
      isSupportSession: true,
      supportOrganizationId: supportSession.organizationId,
    }
  }

  return {
    authenticatedUser: user,
    effectiveUserId: user.id,
    isSupportSession: false,
    supportOrganizationId: null,
  }
}

export async function getCustomerPortalClients(): Promise<CustomerPortalClients | null> {
  const session = await resolveCustomerPortalSession()

  if (!session) {
    return null
  }

  return {
    session,
    dataClient: session.isSupportSession
      ? getServiceRoleClient()
      : await createClient(),
    actionClient: await createClient(),
    effectiveUserId: session.effectiveUserId,
  }
}

export async function resolveCustomerPortalActor() {
  const clients = await getCustomerPortalClients()
  if (!clients) {
    return null
  }

  return {
    userId: clients.effectiveUserId,
    supabase: clients.dataClient,
    actionSupabase: clients.actionClient,
    session: clients.session,
  }
}

export async function getCustomerPortalSupabase(): Promise<{
  supabase: SupabaseClient
  session: CustomerPortalSession
}> {
  const clients = await getCustomerPortalClients()

  if (!clients) {
    throw new Error("Not authenticated")
  }

  return {
    supabase: clients.dataClient,
    session: clients.session,
  }
}

export async function requireCustomerPortalSession() {
  return resolveCustomerPortalSession()
}
