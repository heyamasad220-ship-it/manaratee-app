import { Header } from "@/components/layout/header"
import { ContactsListView } from "@/components/contacts/contacts-list-view"

export default function VendorHubVendorsPage() {
  return (
    <>
      <Header title="Vendors" />
      <ContactsListView
        requiredRole="vendor"
        hideRoleFilter
        showStats={false}
        emptyMessage="No vendors yet. Vendor affiliations are added automatically when a vendor application is approved."
      />
    </>
  )
}
