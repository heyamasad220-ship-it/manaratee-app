import { ChildcareRegistrationsClient } from "@/components/child-care/childcare-registrations-client"
import { loadChildcareRegistrationsPageData } from "@/lib/child-care/childcare-registration-actions"
import { getDepartments } from "@/lib/departments/department-queries"
import { fetchApprovedChildcareProviders } from "@/lib/workforce/childcare-provider-queries"
import {
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

export default async function EventManagementChildcareRegistrationsPage() {
  await requireAnyPermission(PERMISSIONS.EVENTS_VIEW, PERMISSIONS.STAFF_VIEW, PERMISSIONS.PROGRAMS_VIEW)

  const [{ events, registrations, stats }, providers, departments] = await Promise.all([
    loadChildcareRegistrationsPageData(),
    fetchApprovedChildcareProviders(),
    getDepartments(),
  ])

  return (
    <ChildcareRegistrationsClient
      initialEvents={events}
      initialRegistrations={registrations}
      initialStats={stats}
      providers={providers}
      departments={(departments || []).map((row) => ({
        id: row.id as string,
        name: (row.name as string) || "Department",
      }))}
    />
  )
}
