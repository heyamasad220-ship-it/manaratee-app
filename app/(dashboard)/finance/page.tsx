import { redirect } from "next/navigation"

import { FINANCE_TRANSACTIONS_PATH } from "@/lib/finance/finance-paths"

/** Finance module home → Transactions. */
export default function FinanceIndexPage() {
  redirect(FINANCE_TRANSACTIONS_PATH)
}
