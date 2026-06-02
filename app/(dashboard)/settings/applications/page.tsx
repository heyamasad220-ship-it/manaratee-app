import { redirect } from "next/navigation"
import { peopleManagementApplicationsUrl } from "@/lib/applications/application-routes"

export default function SettingsApplicationsRedirectPage() {
  redirect(peopleManagementApplicationsUrl())
}
