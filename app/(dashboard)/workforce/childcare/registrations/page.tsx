import { ChildcareRegistrationsClient } from "@/components/child-care/childcare-registrations-client"
import { loadChildcareRegistrationsPageData } from "@/lib/child-care/childcare-registration-actions"
import { fetchApprovedChildcareProviders } from "@/lib/workforce/childcare-provider-queries"
import {
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

export default async function WorkforceChildcareRegistrationsPage() {
  await requireAnyPermission(PERMISSIONS.STAFF_VIEW, PERMISSIONS.EVENTS_VIEW, PERMISSIONS.PROGRAMS_VIEW)

  const [{ events, registrations, stats }, providers] = await Promise.all([
    loadChildcareRegistrationsPageData(),
    fetchApprovedChildcareProviders(),
  ])

  return (
    <ChildcareRegistrationsClient
      initialEvents={events}
      initialRegistrations={registrations}
      initialStats={stats}
      providers={providers}
    />
  )
}
