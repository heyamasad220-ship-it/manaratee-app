import { Header } from "@/components/layout/header"
import { ContactsListView } from "@/components/contacts/contacts-list-view"

export default function VendorHubVendorsPage() {
  return (
    <>
      <Header title="Vendors" />
      <ContactsListView
        requiredRole="vendor"
        defaultAddRoles={["vendor"]}
        hideRoleFilter
        showStats={false}
        emptyMessage="No vendors yet. Add a contact with the Vendor role."
      />
    </>
  )
}
