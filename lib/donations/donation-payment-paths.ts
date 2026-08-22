export const DONATION_TRANSACTIONS_PATH = "/donations/payments/transactions"
export const DONATION_RECURRING_OPS_PATH = "/donations/payments/recurring"
export const DONATION_IMPORT_MATCH_PATH = "/donations/payments/import-match"
export const DONATION_RECEIPTS_OPS_PATH = "/donations/payments/receipts"

export const DONATION_REPORTS_HOME_PATH = "/donations/reports"
export const DONATION_REPORTS_GIVING_PATH = "/donations/reports/giving"
export const DONATION_REPORTS_DONORS_PATH = "/donations/reports/donors"
export const DONATION_REPORTS_CAMPAIGNS_PATH = "/donations/reports/campaigns"
export const DONATION_REPORTS_PLEDGES_ANALYTICS_PATH = "/donations/reports/pledges"
export const DONATION_REPORTS_RECURRING_ANALYTICS_PATH = "/donations/reports/recurring-giving"

/** @deprecated Redirects to {@link DONATION_TRANSACTIONS_PATH}. */
export const DONATION_REPORTS_ONE_TIME_PATH = "/donations/reports/one-time"
/** @deprecated Redirects to {@link DONATION_RECURRING_OPS_PATH}. */
export const DONATION_REPORTS_RECURRING_PATH = "/donations/reports/recurring"
/** @deprecated Redirects to {@link DONATION_IMPORT_MATCH_PATH}. */
export const DONATION_REPORTS_IMPORT_PATH = "/donations/reports/import"
/** @deprecated Redirects to {@link DONATION_IMPORT_MATCH_PATH}. */
export const DONATION_REPORTS_MATCH_PATH = "/donations/reports/match"
/** @deprecated Redirects to {@link DONATION_RECEIPTS_OPS_PATH}. */
export const DONATION_REPORTS_RECEIPTS_PATH = "/donations/reports/receipts"
/** @deprecated Redirects to {@link DONATION_REPORTS_CAMPAIGNS_PATH}. */
export const DONATION_REPORTS_CAMPAIGN_GROUPS_PATH = "/donations/reports/campaign-groups"

export function isDonationReportsPath(pathname: string) {
  return pathname === "/donations/reports" || pathname.startsWith("/donations/reports/")
}

export function isDonationReportsOneTimePath(pathname: string) {
  return (
    pathname === DONATION_TRANSACTIONS_PATH ||
    pathname.startsWith(`${DONATION_TRANSACTIONS_PATH}/`) ||
    pathname === "/donations/reports/one-time" ||
    pathname.startsWith("/donations/reports/one-time/") ||
    pathname === "/donations/payments/one-time" ||
    pathname.startsWith("/donations/payments/one-time/")
  )
}

export function isDonationReportsRecurringPath(pathname: string) {
  return (
    pathname === DONATION_RECURRING_OPS_PATH ||
    pathname.startsWith(`${DONATION_RECURRING_OPS_PATH}/`) ||
    pathname === DONATION_REPORTS_RECURRING_PATH ||
    pathname.startsWith(`${DONATION_REPORTS_RECURRING_PATH}/`)
  )
}

export function isDonationOpsPath(pathname: string) {
  return (
    pathname === "/donations/payments" ||
    pathname.startsWith("/donations/payments/") ||
    pathname === "/donations/import" ||
    pathname.startsWith("/donations/import/") ||
    pathname === "/donations/reconcile" ||
    pathname.startsWith("/donations/reconcile/") ||
    pathname === "/donations/recurring" ||
    pathname.startsWith("/donations/recurring/")
  )
}

/** @deprecated Use isDonationOpsPath — operational payment URLs live under /donations/payments. */
export function isDonationPaymentsPath(pathname: string) {
  return isDonationOpsPath(pathname)
}

/** @deprecated Use isDonationReportsOneTimePath */
export function isDonationPaymentsOneTimePath(pathname: string) {
  return isDonationReportsOneTimePath(pathname)
}

/** @deprecated Use isDonationReportsRecurringPath */
export function isDonationPaymentsRecurringPath(pathname: string) {
  return isDonationReportsRecurringPath(pathname)
}

export function donationPaymentDetailHref(paymentId: string) {
  return `/donations/payments/${paymentId}`
}

export function donationRecordPaymentHref(input?: { contactId?: string }) {
  const params = new URLSearchParams()
  params.set("action", "add")
  if (input?.contactId) {
    params.set("contactId", input.contactId)
  }
  return `${DONATION_TRANSACTIONS_PATH}?${params.toString()}`
}

export function donationImportMatchHref(input?: { view?: "import" | "match"; tab?: string }) {
  const params = new URLSearchParams()
  if (input?.view) params.set("view", input.view)
  if (input?.tab) params.set("tab", input.tab)
  const query = params.toString()
  return query ? `${DONATION_IMPORT_MATCH_PATH}?${query}` : DONATION_IMPORT_MATCH_PATH
}

export function donationReceiptsHref(input?: {
  tab?: "receipts" | "statements"
  status?: "missing" | "generated"
}) {
  const params = new URLSearchParams()
  if (input?.tab && input.tab !== "receipts") params.set("tab", input.tab)
  if (input?.status) params.set("status", input.status)
  const query = params.toString()
  return query ? `${DONATION_RECEIPTS_OPS_PATH}?${query}` : DONATION_RECEIPTS_OPS_PATH
}

export function isDonationPaymentDetailPath(pathname: string) {
  return /^\/donations\/payments\/[0-9a-f-]{36}$/i.test(pathname)
}
