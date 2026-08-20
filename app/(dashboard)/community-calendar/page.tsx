import { Header } from "@/components/layout/header"
import { PublicCommunityCalendarView } from "@/components/community-calendar/public-community-calendar-view"
import { requireCommunityCalendarAccess } from "@/lib/community-calendar/access"
import { getPublicCommunityCalendarBySlug } from "@/lib/community-calendar/public-queries"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { getServiceRoleClient } from "@/lib/platform/require-platform-admin"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions/permissions"

export default async function CommunityCalendarPage() {
  await requireCommunityCalendarAccess()

  const organizationId = await getSelectedOrganizationId()
  let organizationSlug: string | null = null
  let organizationName = "Organization"

  if (organizationId) {
    const admin = getServiceRoleClient()
    const { data: org } = await admin
      .from("organizations")
      .select("slug, name")
      .eq("id", organizationId)
      .maybeSingle()
    if (org?.slug) organizationSlug = org.slug as string
    if (org?.name) organizationName = org.name as string
  }

  const catalog = organizationSlug
    ? await getPublicCommunityCalendarBySlug(organizationSlug, {
        includeCommunityVisible: true,
      })
    : {
        organization: {
          id: organizationId || "unknown",
          name: organizationName,
          slug: "org",
        },
        eventTypes: [],
        events: [],
        featured: null,
      }

  const organization = catalog.organization || {
    id: organizationId || "unknown",
    name: organizationName,
    slug: organizationSlug || "org",
  }

  const canEditFeaturedFlyer = await hasAnyPermission(
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.PROGRAMS_MANAGE
  )

  return (
    <>
      <Header title="Community Calendar" />
      <div className="p-6">
        <PublicCommunityCalendarView
          organization={organization}
          eventTypes={catalog.eventTypes}
          events={catalog.events}
          featured={catalog.featured}
          embedded
          showPlaceholdersWhenEmpty
          canEditFeaturedFlyer={canEditFeaturedFlyer}
        />
      </div>
    </>
  )
}
