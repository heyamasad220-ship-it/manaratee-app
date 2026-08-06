import { notFound } from "next/navigation"

import { VendorProfileClient } from "@/components/vendor-hub/network/vendor-profile-client"
import { requireVendorHubManage } from "@/lib/vendor-hub/vendor-hub-permissions"
import { getVendorProfile } from "@/lib/vendor-hub/vendor-profile-queries"

export default async function VendorNetworkVendorProfilePage({
  params,
}: {
  params: Promise<{ contactId: string }>
}) {
  await requireVendorHubManage()
  const { contactId } = await params
  const profile = await getVendorProfile(contactId)

  if (!profile) {
    notFound()
  }

  return <VendorProfileClient profile={profile} />
}
