import { Header } from "@/components/layout/header"
import { OrganizationJoinLinkCard } from "@/components/settings/organization-join-link-card"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { getServiceRoleClient } from "@/lib/platform/require-platform-admin"
import { PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"

export default async function SettingsLinksPage() {
  await requirePermission(PERMISSIONS.SETTINGS_USERS_VIEW)

  const organizationId = await getSelectedOrganizationId()
  let organizationName = "your organization"
  let organizationSlug: string | null = null

  if (organizationId) {
    const admin = getServiceRoleClient()
    const { data } = await admin
      .from("organizations")
      .select("name, slug")
      .eq("id", organizationId)
      .maybeSingle()

    if (data?.name) organizationName = data.name as string
    if (data?.slug) organizationSlug = data.slug as string
  }

  return (
    <>
      <Header title="Settings" />
      <main className="flex-1 overflow-auto bg-background p-4 md:p-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Links</h2>
            <p className="text-sm text-muted-foreground">
              Public pages and customer signup links for this organization.
            </p>
          </div>

          {organizationSlug ? (
            <OrganizationJoinLinkCard
              organizationName={organizationName}
              organizationSlug={organizationSlug}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              This organization does not have a public slug yet, so join links cannot be built.
            </p>
          )}
        </div>
      </main>
    </>
  )
}
