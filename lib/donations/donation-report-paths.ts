import {
  isDonationPaymentsOneTimePath,
  isDonationPaymentsPath,
  isDonationPaymentsRecurringPath,
  isDonationReportsOneTimePath,
  isDonationReportsPath,
  isDonationReportsRecurringPath,
} from "@/lib/donations/donation-payment-paths"

export function isDonationOverviewActivityPath(pathname: string) {
  return (
    isDonationReportsPath(pathname) ||
    isDonationReportsOneTimePath(pathname) ||
    isDonationReportsRecurringPath(pathname) ||
    isDonationPaymentsPath(pathname) ||
    isDonationPaymentsOneTimePath(pathname) ||
    isDonationPaymentsRecurringPath(pathname)
  )
}

export {
  isDonationPaymentsPath,
  isDonationPaymentsOneTimePath,
  isDonationPaymentsRecurringPath,
  isDonationReportsPath,
  isDonationReportsOneTimePath,
  isDonationReportsRecurringPath,
}
