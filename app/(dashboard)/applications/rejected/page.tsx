import { redirect } from "next/navigation"
import {
  moduleApplicationsUrl,
  peopleManagementApplicationsUrl,
} from "@/lib/applications/application-routes"

function resolveApplicationsRedirect(
  params: { module_owner?: string; application_type?: string },
  status?: "pending_review" | "approved" | "rejected"
) {
  if (params.application_type === "vendor" || params.application_type === "financial_aid") {
    return moduleApplicationsUrl({
      applicationType: params.application_type,
      status,
    })
  }

  if (params.module_owner && params.module_owner !== "hr") {
    return moduleApplicationsUrl({
      moduleOwner: params.module_owner as "vendor_hub" | "programs",
      status,
    })
  }

  return peopleManagementApplicationsUrl({
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
