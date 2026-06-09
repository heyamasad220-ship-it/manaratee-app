import { redirect } from "next/navigation"
import { peopleManagementApplicationsUrl } from "@/lib/applications/application-routes"

export default function ChildCareApplicationsRedirectPage() {
  redirect(
    peopleManagementApplicationsUrl({
      pageTab: "submissions",
      applicationType: "childcare_provider",
    })
  )
}
