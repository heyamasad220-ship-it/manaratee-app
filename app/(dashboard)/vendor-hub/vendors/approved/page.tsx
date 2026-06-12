import { ContactsListView } from "@/components/contacts/contacts-list-view"

export default function VendorHubApprovedVendorsPage() {
  return (
    <ContactsListView
      requiredRole="vendor"
      hideRoleFilter
      showStats={false}
      emptyMessage="No vendors yet. Approved vendor applications add the vendor role to CRM contacts automatically."
    />
  )
}
