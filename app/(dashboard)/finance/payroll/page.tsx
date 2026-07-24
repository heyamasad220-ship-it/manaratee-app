import { Header } from "@/components/layout/header"
import { FinancePayrollQueuePanel } from "@/components/finance/finance-payroll-queue-panel"
import { requireOrganizationModule } from "@/lib/modules/dashboard-module-access-server"
import { requirePermission } from "@/lib/permissions/permissions"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"

export default async function FinancePayrollPage() {
  await requireOrganizationModule("finance")
  await requirePermission(PERMISSIONS.FINANCE_VIEW)

  return (
    <>
      <Header title="Finance" />
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Payroll</h1>
          <p className="text-sm text-muted-foreground">
            Process approved department payroll for teachers and childcare
            providers.
          </p>
        </div>
        <FinancePayrollQueuePanel />
      </div>
    </>
  )
}
