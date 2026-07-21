import { redirect } from "next/navigation"

import { MEMBERSHIP_APPLICATIONS_PATH } from "@/lib/applications/application-routes"

/** Committee applications moved to Membership → Applications. */
export default function WorkforceSettingsCommitteeApplicationsRedirect() {
  redirect(MEMBERSHIP_APPLICATIONS_PATH)
}
