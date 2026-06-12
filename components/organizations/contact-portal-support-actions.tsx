import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { canManageOrgUserSupport } from "@/lib/organizations/org-user-access"
import { isOrganizationSystemAdmin } from "@/lib/organizations/organization-system-admin"
import { EnterCustomerPortalAsUserButton } from "@/components/organizations/enter-customer-portal-as-user-button"
import { getServiceRoleClient } from "@/lib/platform/require-platform-admin"

export async function ContactPortalSupportActions({
  contactId,
}: {
  contactId: string
}) {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return null
  }

  if (!(await canManageOrgUserSupport(organizationId))) {
    return null
  }

  const admin = getServiceRoleClient()
  const { data: contact } = await admin
    .from("contacts")
    .select("auth_user_id, full_name, email")
    .eq("id", contactId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  const authUserId = contact?.auth_user_id as string | undefined
  if (!authUserId) {
    return null
  }

  const { data: membership } = await admin
    .from("organization_members")
    .select("role, status")
    .eq("organization_id", organizationId)
    .eq("user_id", authUserId)
    .maybeSingle()

  if (
    membership?.status === "active" &&
    isOrganizationSystemAdmin(membership.role as string)
  ) {
    return null
  }

  const contactName =
    (contact?.full_name as string | undefined)?.trim() ||
    (contact?.email as string | undefined)?.trim() ||
    "User"

  return (
    <div className="flex justify-end border-b bg-muted/20 px-6 py-2">
      <EnterCustomerPortalAsUserButton
        organizationId={organizationId}
        targetUserId={authUserId}
        userLabel={contactName}
        variant="outline"
        size="sm"
      />
    </div>
  )
}
