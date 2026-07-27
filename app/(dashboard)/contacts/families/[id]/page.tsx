import { notFound, redirect } from "next/navigation"

import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import { createClient } from "@/lib/supabase/server"
import { resolveOrganizationId } from "@/lib/organizations/resolve-organization-id"

/**
 * Legacy family “profile” URL — contact is the canonical record.
 * Redirects to the household’s primary contact.
 */
export default async function ContactFamilyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()

  if (!organizationId) {
    notFound()
  }

  const { data: family, error } = await supabase
    .from("families")
    .select("id, primary_contact_id")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle()

  if (error || !family) {
    notFound()
  }

  const primaryContactId = family.primary_contact_id as string | null
  if (!primaryContactId) {
    redirect("/contacts/reports/directory?tab=families")
  }

  redirect(
    contactProfileHref(primaryContactId, {
      list: "families",
      returnTo: "/contacts/reports/directory?tab=families",
    })
  )
}
