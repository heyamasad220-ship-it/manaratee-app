import { redirect } from "next/navigation"

import { requireOrganizationModule } from "@/lib/modules/dashboard-module-access-server"
import { requirePermission } from "@/lib/permissions/permissions"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"

export default async function FinanceIndexPage() {
  await requireOrganizationModule("finance")
  await requirePermission(PERMISSIONS.FINANCE_VIEW)
  redirect("/finance/payroll")
}
