export const DONATION_REPORTS_PLEDGES_PATH = "/donations/reports/pledges"

export function donationPledgesHref(input?: {
  pledgeId?: string
  action?: "add" | "edit" | "pay" | "view"
  campaignId?: string
  hash?: string
}) {
  const params = new URLSearchParams()

  if (input?.pledgeId) {
    params.set("pledgeId", input.pledgeId)
  }

  if (input?.action) {
    params.set("action", input.action)
  }

  if (input?.campaignId) {
    params.set("campaignId", input.campaignId)
  }

  const query = params.toString()
  const hash = input?.hash ? `#${input.hash.replace(/^#/, "")}` : ""

  return query
    ? `${DONATION_REPORTS_PLEDGES_PATH}?${query}${hash}`
    : `${DONATION_REPORTS_PLEDGES_PATH}${hash}`
}

/** @deprecated Use DONATION_REPORTS_PLEDGES_PATH — legacy route redirects to reports. */
export const DONATION_PLEDGES_PATH = DONATION_REPORTS_PLEDGES_PATH

export function isDonationPledgesPath(pathname: string) {
  return (
    pathname === DONATION_REPORTS_PLEDGES_PATH ||
    pathname.startsWith(`${DONATION_REPORTS_PLEDGES_PATH}/`) ||
    pathname === "/donations/pledges" ||
    pathname.startsWith("/donations/pledges/")
  )
}
