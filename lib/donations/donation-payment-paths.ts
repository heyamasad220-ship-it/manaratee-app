export function isDonationPaymentsPath(pathname: string) {
  return (
    pathname === "/donations/payments" ||
    pathname.startsWith("/donations/payments/")
  )
}

export function isDonationPaymentsOneTimePath(pathname: string) {
  return (
    pathname === "/donations/payments/one-time" ||
    pathname.startsWith("/donations/payments/one-time/")
  )
}

export function isDonationPaymentsRecurringPath(pathname: string) {
  return (
    pathname === "/donations/payments/recurring" ||
    pathname.startsWith("/donations/payments/recurring/")
  )
}

export function donationPaymentDetailHref(paymentId: string) {
  return `/donations/payments/${paymentId}`
}

export function isDonationPaymentDetailPath(pathname: string) {
  return /^\/donations\/payments\/[0-9a-f-]{36}$/i.test(pathname)
}
