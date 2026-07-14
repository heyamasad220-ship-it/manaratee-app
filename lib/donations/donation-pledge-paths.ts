export const DONATION_PLEDGES_PATH = "/donations/campaigns/pledges"

/** @deprecated Legacy reports route — redirects to {@link DONATION_PLEDGES_PATH}. */
export const DONATION_REPORTS_PLEDGES_PATH = "/donations/reports/pledges"

export function donationPledgesHref(input?: {
  pledgeId?: string
  action?: "add" | "edit" | "pay" | "view"
  campaignId?: string
  contactId?: string
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

  if (input?.contactId) {
    params.set("contactId", input.contactId)
  }

  const query = params.toString()
  const hash = input?.hash ? `#${input.hash.replace(/^#/, "")}` : ""

  return query
    ? `${DONATION_PLEDGES_PATH}?${query}${hash}`
    : `${DONATION_PLEDGES_PATH}${hash}`
}

export function isDonationPledgesPath(pathname: string) {
  return (
    pathname === DONATION_PLEDGES_PATH ||
    pathname.startsWith(`${DONATION_PLEDGES_PATH}/`) ||
    pathname === DONATION_REPORTS_PLEDGES_PATH ||
    pathname.startsWith(`${DONATION_REPORTS_PLEDGES_PATH}/`) ||
    pathname === "/donations/pledges" ||
    pathname.startsWith("/donations/pledges/")
  )
}
