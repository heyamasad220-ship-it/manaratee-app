import { ContactsListView } from "@/components/contacts/contacts-list-view"
import {
  ensureVendorInactiveStatusForCurrentOrg,
  ensureVendorNetworkRolesForCurrentOrg,
} from "@/lib/vendor-hub/vendor-network-sync-actions"
import { requireVendorHubManage } from "@/lib/vendor-hub/vendor-hub-permissions"

export default async function VendorNetworkVendorsPage() {
  await requireVendorHubManage()
  // Keep Vendor Network in sync with approved applications (imports / merges).
  await ensureVendorNetworkRolesForCurrentOrg()
  // Mark vendors inactive when last activity is older than 2 years.
  await ensureVendorInactiveStatusForCurrentOrg()

  return (
    <ContactsListView
      requiredRole="vendor"
      hideRoleFilter
      hideRecordTypeFilter
      vendorNetworkLayout
      showStats={false}
      emptyMessage="No vendors yet. Approved vendor applications add the vendor role to CRM contacts automatically."
    />
  )
}
