import { Header } from "@/components/layout/header"
import { ApplicationsSettingsClient } from "@/components/applications/applications-settings-client"
import { PERMISSIONS, requirePermission } from "@/lib/permissions/permissions"

export default async function ApplicationsSettingsPage() {
  await requirePermission(PERMISSIONS.APPLICATIONS_MANAGE)

  return (
    <>
      <Header title="Application Settings" />
      <ApplicationsSettingsClient />
    </>
  )
}
