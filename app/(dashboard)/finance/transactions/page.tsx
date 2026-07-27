import { Suspense } from "react"

import { Header } from "@/components/layout/header"
import { OrgReportsClient } from "@/components/reports/org-reports-client"
import { FINANCE_TRANSACTIONS_PATH } from "@/lib/finance/finance-paths"
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import { redirect } from "next/navigation"

export default async function FinanceTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const canView =
    (await hasPermission(PERMISSIONS.FINANCE_VIEW)) ||
    (await hasPermission(PERMISSIONS.REPORTS_VIEW))
  if (!canView) {
    redirect("/unauthorized")
  }

  const { tab } = await searchParams

  return (
    <>
      <Header title="Transactions" />
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organization-wide payment activity across donations and programs.
          </p>
        </div>
        <Suspense
          fallback={
            <div className="rounded-lg border px-4 py-10 text-center text-sm text-muted-foreground">
              Loading transactions…
            </div>
          }
        >
          <OrgReportsClient
            initialTab={tab}
            basePath={FINANCE_TRANSACTIONS_PATH}
          />
        </Suspense>
      </div>
    </>
  )
}
