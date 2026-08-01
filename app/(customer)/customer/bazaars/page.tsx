import { redirect } from "next/navigation"

import { MyBazaarsClient } from "@/components/customer/my-bazaars-client"
import { requireCustomerPortalPageContext } from "@/lib/auth/require-customer-portal-page"
import { getVendorInboxMessages } from "@/lib/vendor-hub/vendor-announcement-actions"
import { getVendorPaymentDueForCurrentUser } from "@/lib/vendor-hub/vendor-booth-payment-actions"
import { getReservableBazaarEventsForCurrentUser } from "@/lib/vendor-hub/vendor-booth-reservation-actions"
import { isAuthUserApprovedVendorForOrganization } from "@/lib/vendor-hub/vendor-eligibility-queries"
import { getMyVendorBazaarActivity } from "@/lib/vendor-hub/vendor-portal-queries"

export default async function CustomerMyBazaarsPage() {
  const { organizationId, userId } = await requireCustomerPortalPageContext()

  const isApprovedVendor = await isAuthUserApprovedVendorForOrganization(
    userId,
    organizationId
  )

  if (!isApprovedVendor) {
    // Apply via Opportunities / profile — My Bazaars is for approved vendors only.
    redirect("/customer/opportunities")
  }

  const [summary, reservableEvents, paymentDue, inboxMessages] = await Promise.all([
    getMyVendorBazaarActivity(),
    getReservableBazaarEventsForCurrentUser(),
    getVendorPaymentDueForCurrentUser(),
    getVendorInboxMessages(),
  ])

  return (
    <MyBazaarsClient
      summary={{ ...summary, paymentDue }}
      reservableEvents={reservableEvents}
      inboxMessages={inboxMessages}
    />
  )
}
