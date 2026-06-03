"use client"

import { switchOrganizationAction } from "@/app/(customer)/actions/switch-organization"
import { formatCustomerPortalRoleLabel } from "@/lib/customer/customer-portal-role-label"

type Organization = {
  organization_id: string
  organization_name: string
  role_name: string
}

export function OrganizationSwitcher({
  organizations,
  activeOrganizationId,
}: {
  organizations: Organization[]
  activeOrganizationId: string
}) {
  if (!organizations || organizations.length <= 1) {
    return null
  }

  return (
    <form action={switchOrganizationAction} className="w-full">
      <select
        name="organization_id"
        defaultValue={activeOrganizationId}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
      >
        {organizations.map((org) => (
          <option key={org.organization_id} value={org.organization_id}>
            {org.organization_name} — {formatCustomerPortalRoleLabel(org.role_name)}
          </option>
        ))}
      </select>
    </form>
  )
}