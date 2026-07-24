import { redirect } from "next/navigation"
import { peopleManagementApplicationsUrl } from "@/lib/applications/application-routes"
import { statusTabIdFromQueryParam } from "@/lib/applications/application-status-tabs"
import { PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"

/** Legacy Settings → Applications hub. Submissions now live under HR category tabs. */
export default async function SettingsApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string
    status?: string
    application_type?: string
  }>
}) {
  await requirePermission(PERMISSIONS.APPLICATIONS_VIEW)

  const { tab, status, application_type } = await searchParams

  // Templates hub removed — send legacy links to HR Overview.
  if (tab === "templates") {
    redirect("/workforce")
  }

  redirect(
    peopleManagementApplicationsUrl({
      pageTab: "submissions",
      status: statusTabIdFromQueryParam(status),
      applicationType: application_type,
    })
  )
}
