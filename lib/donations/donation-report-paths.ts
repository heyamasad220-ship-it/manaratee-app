import {
  isDonationPaymentsOneTimePath,
  isDonationPaymentsPath,
  isDonationPaymentsRecurringPath,
} from "@/lib/donations/donation-payment-paths"

/** @deprecated Use isDonationPaymentsPath helpers; kept for legacy report URL redirects. */
export function isDonationOverviewActivityPath(pathname: string) {
  return (
    isDonationPaymentsPath(pathname) ||
    pathname === "/donations/reports/one-time" ||
    pathname.startsWith("/donations/reports/one-time/") ||
    pathname === "/donations/reports/recurring" ||
    pathname.startsWith("/donations/reports/recurring/")
  )
}

export { isDonationPaymentsPath, isDonationPaymentsOneTimePath, isDonationPaymentsRecurringPath }
