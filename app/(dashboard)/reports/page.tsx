import { redirect } from "next/navigation"

import { financeTransactionsHref } from "@/lib/finance/finance-paths"

/** Legacy org Reports → Finance → Transactions. */
export default async function OrganizationReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  redirect(financeTransactionsHref({ tab }))
}
