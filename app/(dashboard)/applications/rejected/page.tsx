import { redirect } from "next/navigation"
import {
  moduleApplicationsUrl,
  peopleManagementApplicationsUrl,
} from "@/lib/applications/application-routes"

import { isWorkforceModuleOwner } from "@/lib/applications/application-types"

function resolveApplicationsRedirect(
  params: { module_owner?: string; application_type?: string },
  status?: "pending_review" | "approved" | "rejected"
) {
  if (params.application_type) {
    return moduleApplicationsUrl({
      applicationType: params.application_type,
      pageTab: "submissions",
      status,
    })
  }

  if (params.module_owner && !isWorkforceModuleOwner(params.module_owner)) {
    return moduleApplicationsUrl({
      moduleOwner: params.module_owner as "vendor_hub" | "programs",
      pageTab: "submissions",
      status,
    })
  }

  return peopleManagementApplicationsUrl({
    pageTab: "submissions",
    status,
    applicationType: params.application_type,
  })
}

export default async function ApplicationsRejectedRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ module_owner?: string; application_type?: string }>
}) {
  const params = await searchParams
  redirect(resolveApplicationsRedirect(params, "rejected"))
}
