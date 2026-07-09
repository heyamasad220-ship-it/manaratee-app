import { CustomerNav } from "@/components/customer/customer-nav"
import { CustomerWelcomeHeader } from "@/components/customer/customer-welcome-header"
import { OrgUserSupportBanner } from "@/components/organizations/org-user-support-banner"
import { getUserPortalCapabilities } from "@/lib/auth/portal-capabilities"
import { resolveCustomerPortalSession } from "@/lib/auth/customer-portal-session"
import { getCustomerPortalSupabase } from "@/lib/auth/customer-portal-session"
import { resolveCustomerDisplayName } from "@/lib/customer/customer-display-name"
import { loadCustomerPortalEnabledModuleSlugs } from "@/lib/customer/customer-portal-modules-server"
import { getActiveOrganization } from "@/lib/organizations/get-active-organization"
import { linkVendorContactsForCurrentUser } from "@/lib/vendor-hub/link-vendor-contact-auth"
import { createClient } from "@/lib/supabase/server"

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { activeOrganization, organizations } =
    await getActiveOrganization()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const portalSession = user ? await resolveCustomerPortalSession() : null
  const effectiveUserId = portalSession?.effectiveUserId ?? user?.id

  const portalCapabilities = effectiveUserId
    ? await getUserPortalCapabilities(
        effectiveUserId,
        activeOrganization?.organization_id
      )
    : {
        hasPersonalPortal: false,
        hasTeachingPortal: false,
        hasStaffToolsPortal: false,
        canManageEventRequests: false,
        hasAdminPortal: false,
      }

  if (user && !portalSession?.isSupportSession) {
    await linkVendorContactsForCurrentUser(supabase)
  }

  const enabledModuleSlugs = activeOrganization?.organization_id
    ? Array.from(
        await loadCustomerPortalEnabledModuleSlugs(activeOrganization.organization_id)
      )
    : []

  let customerName = user?.email?.split("@")[0] || "Customer"
  if (activeOrganization?.organization_id && portalSession) {
    const { supabase, session } = await getCustomerPortalSupabase()
    const { data: contact } = await supabase
      .from("contacts")
      .select("full_name, email")
      .eq("auth_user_id", session.effectiveUserId)
      .eq("organization_id", activeOrganization.organization_id)
      .maybeSingle()

    customerName = resolveCustomerDisplayName(
      contact?.full_name,
      contact?.email || user?.email || null
    )
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <CustomerNav
        activeOrganization={activeOrganization}
        organizations={organizations}
        portalCapabilities={portalCapabilities}
        enabledModuleSlugs={enabledModuleSlugs}
        customerName={customerName}
      />

      <main className="min-w-0 flex-1 overflow-x-hidden">
        <OrgUserSupportBanner />
        <div className="w-full space-y-6 px-4 py-5 sm:px-5 lg:px-6">
          <CustomerWelcomeHeader />
          {children}
        </div>
      </main>
    </div>
  )
}