import { redirect } from "next/navigation"
import { peopleManagementApplicationsUrl } from "@/lib/applications/application-routes"
import { statusTabIdFromQueryParam } from "@/lib/applications/application-status-tabs"

export default async function HrApplicationsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; application_type?: string }>
}) {
  const params = await searchParams
  redirect(
    peopleManagementApplicationsUrl({
      pageTab: "submissions",
      status: statusTabIdFromQueryParam(params.status),
      applicationType: params.application_type,
    })
  )
}
