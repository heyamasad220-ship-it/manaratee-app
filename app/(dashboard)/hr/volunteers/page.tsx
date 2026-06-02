import { Header } from "@/components/layout/header"
import { ContactsListView } from "@/components/contacts/contacts-list-view"
import { ModuleApplicationsLink } from "@/components/applications/module-applications-link"

export default function HrVolunteersPage() {
  return (
    <>
      <Header
        title="Volunteers"
        actions={<ModuleApplicationsLink applicationType="volunteer" label="Volunteer Applications" />}
      />
      <ContactsListView
        requiredRole="volunteer"
        defaultAddRoles={["volunteer"]}
        hideRoleFilter
        showStats={false}
        emptyMessage="No volunteers yet. Add a contact with the Volunteer role."
      />
    </>
  )
}
