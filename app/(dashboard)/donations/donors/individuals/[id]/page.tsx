import { redirect } from "next/navigation"

import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import { requireDonationStaffAccess } from "@/lib/donations/donation-action-auth"

export default async function IndividualDonorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const access = await requireDonationStaffAccess("view")
  if (!access.ok) {
    redirect("/dashboard")
  }

  const { data: donor } = await access.supabase
    .from("donors")
    .select("contact_id")
    .eq("organization_id", access.orgId)
    .eq("id", id)
    .maybeSingle()

  if (donor?.contact_id) {
    redirect(contactProfileHref(donor.contact_id as string, "financial"))
  }

  redirect("/donations/reports/donors")
}
