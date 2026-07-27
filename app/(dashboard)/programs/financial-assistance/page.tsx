import { redirect } from "next/navigation"

import { FINANCE_FINANCIAL_ASSISTANCE_PATH } from "@/lib/finance/finance-paths"

/** Legacy Programs → Financial Assistance → Finance. */
export default async function ProgramsFinancialAssistanceRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const resolved = await searchParams
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(resolved)) {
    if (value == null) continue
    const text = Array.isArray(value) ? value[0] : value
    if (text) params.set(key, text)
  }
  const query = params.toString()
  redirect(
    query
      ? `${FINANCE_FINANCIAL_ASSISTANCE_PATH}?${query}`
      : FINANCE_FINANCIAL_ASSISTANCE_PATH
  )
}
