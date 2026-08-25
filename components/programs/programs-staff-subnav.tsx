import { Suspense } from "react"

import { ProgramsFinanceNav } from "@/components/programs/programs-finance-nav"
import { ProgramsReportsNav } from "@/components/programs/programs-reports-nav"
import {
  isOrganizationModuleEnabled,
  loadOrganizationEnabledModuleSlugs,
} from "@/lib/modules/dashboard-module-access-server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

export async function ProgramsStaffSubnav({
  secondary,
  requireProgramsModule = false,
}: {
  secondary?: "reports" | "finance"
  /** Finance routes also exist without Programs — hide module chrome then. */
  requireProgramsModule?: boolean
}) {
  if (!secondary) {
    return null
  }

  if (requireProgramsModule) {
    const organizationId = await getSelectedOrganizationId()
    const enabled = organizationId
      ? await loadOrganizationEnabledModuleSlugs(organizationId)
      : new Set<string>()
    if (!isOrganizationModuleEnabled(enabled, "programs")) {
      return null
    }
  }

  return (
    <>
      {secondary === "reports" ? (
        <Suspense fallback={null}>
          <ProgramsReportsNav />
        </Suspense>
      ) : null}
      {secondary === "finance" ? (
        <Suspense fallback={null}>
          <ProgramsFinanceNav />
        </Suspense>
      ) : null}
    </>
  )
}
