import { PERMISSIONS, requireAnyPermission } from "@/lib/permissions/permissions"
import { AuditLogClient } from "./audit-log-client"

export default async function AuditLogPage() {
  await requireAnyPermission(
    PERMISSIONS.SETTINGS_USERS_VIEW,
    PERMISSIONS.SETTINGS_ROLES_VIEW,
    PERMISSIONS.DONATIONS_VIEW,
    PERMISSIONS.DONATIONS_MANAGE
  )

  return <AuditLogClient />
}
