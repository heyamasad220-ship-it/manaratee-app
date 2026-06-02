import { Header } from "@/components/layout/header"
import { ContactsListView } from "@/components/contacts/contacts-list-view"

export default function HrServiceProvidersPage() {
  return (
    <>
      <Header title="Service Providers" />
      <ContactsListView
        requiredRole="service_provider"
        defaultAddRoles={["service_provider"]}
        hideRoleFilter
        showStats={false}
        emptyMessage="No service providers yet. Add a contact with the Service Provider role."
      />
    </>
  )
}
