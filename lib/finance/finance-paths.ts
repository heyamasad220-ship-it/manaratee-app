/** Canonical Finance module routes (org money operations). */

export const FINANCE_BASE_PATH = "/finance"
export const FINANCE_TRANSACTIONS_PATH = "/finance/transactions"
export const FINANCE_PAYROLL_PATH = "/finance/payroll"
export const FINANCE_FINANCIAL_ASSISTANCE_PATH =
  "/finance/financial-assistance"

export function financeTransactionsHref(options?: { tab?: string }) {
  const params = new URLSearchParams()
  if (options?.tab && options.tab !== "payments") {
    params.set("tab", options.tab)
  }
  const query = params.toString()
  return query
    ? `${FINANCE_TRANSACTIONS_PATH}?${query}`
    : FINANCE_TRANSACTIONS_PATH
}

export function financePayrollHref() {
  return FINANCE_PAYROLL_PATH
}
