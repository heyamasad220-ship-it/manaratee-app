import { redirect, notFound } from "next/navigation"

import { Header } from "@/components/layout/header"
import { EmployeeProfileClient } from "@/components/hr/employee-profile-client"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { createClient } from "@/lib/supabase/server"

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: staffId } = await params
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    notFound()
  }

  const supabase = await createClient()
  const { data: staff } = await supabase
    .from("staff")
    .select("contact_id")
    .eq("organization_id", organizationId)
    .eq("id", staffId)
    .maybeSingle()

  if (staff?.contact_id) {
    redirect(contactProfileHref(staff.contact_id as string, "workforce"))
  }

  return (
    <>
      <Header title="Employee Profile" />
      <EmployeeProfileClient staffId={staffId} organizationId={organizationId} />
    </>
  )
}
