import { Header } from "@/components/layout/header"
import { ProgramsSettingsNav } from "@/components/programs/programs-settings-nav"
import { ProgramServiceNeedsSettingsClient } from "@/components/programs/program-service-needs-settings-client"
import { getPrograms } from "@/lib/programs/program-queries"
import { getVendorHubVendorTypes } from "@/lib/vendor-hub/vendor-type-queries"
import { hasAnyPermission, PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"

export default async function ProgramServiceNeedsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ programId?: string }>
}) {
  await requirePermission(PERMISSIONS.PROGRAMS_MANAGE)

  const { programId } = await searchParams
  const [programs, vendorTypes, canManageVendorTypes] = await Promise.all([
    getPrograms(),
    getVendorHubVendorTypes({ activeOnly: true }),
    hasAnyPermission(PERMISSIONS.EVENTS_MANAGE, PERMISSIONS.PROGRAMS_MANAGE),
  ])

  return (
    <>
      <Header title="Settings" />
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Configure volunteer, childcare, and vendor needs for programs.
          </p>
        </div>

        <ProgramsSettingsNav />

        <ProgramServiceNeedsSettingsClient
          programs={programs.map((program) => ({
            id: program.id as string,
            name: String(program.name || "Untitled program"),
          }))}
          vendorTypes={vendorTypes}
          canManageVendorTypes={canManageVendorTypes}
          initialProgramId={programId ?? null}
        />
      </div>
    </>
  )
}
