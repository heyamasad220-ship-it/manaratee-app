import { redirect } from "next/navigation"
import {
  HR_APPLICATION_TEMPLATES_PATH,
  peopleManagementApplicationsUrl,
} from "@/lib/applications/application-routes"
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

  if (tab === "templates") {
    redirect(HR_APPLICATION_TEMPLATES_PATH)
  }

  redirect(
    peopleManagementApplicationsUrl({
      pageTab: "submissions",
      status: statusTabIdFromQueryParam(status),
      applicationType: application_type,
    })
  )
}
