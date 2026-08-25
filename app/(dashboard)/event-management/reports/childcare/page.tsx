import { ChildcareRegistrationsClient } from "@/components/child-care/childcare-registrations-client"
import { loadChildcareRegistrationsPageData } from "@/lib/child-care/childcare-registration-actions"
import { getDepartments } from "@/lib/departments/department-queries"
import { fetchApprovedChildcareProviders } from "@/lib/workforce/childcare-provider-queries"
import {
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

export default async function EventManagementChildcareReportsPage() {
  await requireAnyPermission(
    PERMISSIONS.EVENTS_VIEW,
    PERMISSIONS.STAFF_VIEW,
    PERMISSIONS.PROGRAMS_VIEW,
    PERMISSIONS.REPORTS_VIEW
  )

  const [{ events, registrations, stats }, providers, departments] =
    await Promise.all([
      loadChildcareRegistrationsPageData(),
      fetchApprovedChildcareProviders(),
      getDepartments(),
    ])

  return (
    <>
      <div className="border-b border-border bg-background px-6 py-4">
        <h2 className="text-2xl font-semibold tracking-tight">
          Childcare Registrations
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Event childcare sign-ups, waitlists, and provider assignments.
        </p>
      </div>

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
    </>
  )
}
