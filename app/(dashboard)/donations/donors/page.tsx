import { Header } from "@/components/layout/header"
import { ContactsListView } from "@/components/contacts/contacts-list-view"

export default function DonationsDonorsPage() {
  return (
    <>
      <Header title="Donors" />
      <ContactsListView
        requiredRole="donor"
        defaultAddRoles={["donor"]}
        hideRoleFilter
        showStats={false}
        emptyMessage="No donors yet. Add a contact with the Donor role."
      />
    </>
  )
}
