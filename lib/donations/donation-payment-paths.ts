export function isDonationReportsPath(pathname: string) {
  return (
    pathname === "/donations/reports" ||
    pathname.startsWith("/donations/reports/")
  )
}

export function isDonationReportsOneTimePath(pathname: string) {
  return (
    pathname === "/donations/reports/one-time" ||
    pathname.startsWith("/donations/reports/one-time/") ||
    pathname === "/donations/payments/one-time" ||
    pathname.startsWith("/donations/payments/one-time/")
  )
}

export function isDonationReportsRecurringPath(pathname: string) {
  return (
    pathname === "/donations/reports/recurring" ||
    pathname.startsWith("/donations/reports/recurring/") ||
    pathname === "/donations/payments/recurring" ||
    pathname.startsWith("/donations/payments/recurring/")
  )
}

/** @deprecated Use isDonationReportsPath — legacy payments list URLs redirect to reports. */
export function isDonationPaymentsPath(pathname: string) {
  return (
    pathname === "/donations/payments" ||
    pathname.startsWith("/donations/payments/")
  )
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

export function isDonationPaymentDetailPath(pathname: string) {
  return /^\/donations\/payments\/[0-9a-f-]{36}$/i.test(pathname)
}

export const DONATION_REPORTS_ONE_TIME_PATH = "/donations/reports/one-time"
export const DONATION_REPORTS_RECURRING_PATH = "/donations/reports/recurring"
export const DONATION_REPORTS_IMPORT_PATH = "/donations/reports/import"
export const DONATION_REPORTS_MATCH_PATH = "/donations/reports/match"
