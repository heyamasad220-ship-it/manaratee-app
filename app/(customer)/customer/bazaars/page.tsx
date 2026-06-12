import { redirect } from "next/navigation"

import { MyBazaarsClient } from "@/components/customer/my-bazaars-client"
import { getReservableBazaarEventsForCurrentUser } from "@/lib/vendor-hub/vendor-booth-reservation-actions"
import { getVendorPaymentDueForCurrentUser } from "@/lib/vendor-hub/vendor-booth-payment-actions"
import { getVendorInboxMessages } from "@/lib/vendor-hub/vendor-announcement-actions"
import { getMyVendorBazaarActivity } from "@/lib/vendor-hub/vendor-portal-queries"
import { createClient } from "@/lib/supabase/server"

export default async function CustomerMyBazaarsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
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
