import { CustomerNav } from "@/components/customer/customer-nav"
import { getUserPortalCapabilities } from "@/lib/auth/portal-capabilities"
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

  const portalCapabilities = user
    ? await getUserPortalCapabilities(
        user.id,
        activeOrganization?.organization_id
      )
    : {
        hasPersonalPortal: false,
        hasTeachingPortal: false,
        hasStaffToolsPortal: false,
        canManageEventRequests: false,
        hasAdminPortal: false,
      }

  if (user) {
    await linkVendorContactsForCurrentUser(supabase)
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <CustomerNav
        activeOrganization={activeOrganization}
        organizations={organizations}
        portalCapabilities={portalCapabilities}
      />

      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-7xl p-6">
          {children}
        </div>
      </main>
    </div>
  )
}