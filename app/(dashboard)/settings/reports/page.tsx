import { redirect } from "next/navigation"

import { FINANCE_TRANSACTIONS_PATH } from "@/lib/finance/finance-paths"

/** Legacy Settings → Reports → Finance Transactions. */
export default function SettingsReportsRedirectPage() {
  redirect(FINANCE_TRANSACTIONS_PATH)
}
