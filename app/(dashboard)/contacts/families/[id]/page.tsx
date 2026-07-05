import Link from "next/link"
import { notFound } from "next/navigation"

import { Header } from "@/components/layout/header"
import { FamilyGivingDetail } from "@/components/contacts/family-giving-detail"
import { Button } from "@/components/ui/button"
import { fetchFamilyGivingRollup } from "@/lib/contacts/family-giving-data"
import { hasPermission } from "@/lib/permissions/permissions"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
import { createClient } from "@/lib/supabase/server"
import { resolveOrganizationId } from "@/lib/organizations/resolve-organization-id"

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

  const result = await fetchFamilyGivingRollup(supabase, organizationId, id)

  if (!result.ok) {
    notFound()
  }

  const canManage = await hasPermission(PERMISSIONS.CONTACTS_MANAGE)

  return (
    <>
      <Header title="Family" />
      <div className="flex flex-col gap-6 p-6">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
            <Link href="/contacts/families">← Back to Families</Link>
          </Button>
        </div>
        <FamilyGivingDetail rollup={result.rollup} canManage={canManage} />
      </div>
    </>
  )
}
