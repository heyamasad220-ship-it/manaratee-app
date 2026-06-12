import { redirect } from "next/navigation"

import { contactProfilePath } from "@/lib/vendor-hub/contact-centric-model"

/**
 * Vendor detail lives in CRM. This route preserves old links to /vendor-hub/vendors/[id].
 */
export default async function VendorHubVendorDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(contactProfilePath(id))
}
