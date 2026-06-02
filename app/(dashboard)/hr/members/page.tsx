import { Header } from "@/components/layout/header"
import { ContactsListView } from "@/components/contacts/contacts-list-view"
import { Button } from "@/components/ui/button"

export default function HrMembersPage() {
  return (
    <>
      <Header title="Members" />
      <ContactsListView
        requiredRole="member"
        defaultAddRoles={["member"]}
        hideRoleFilter
        showStats={false}
        showTeamFilters
        emptyMessage="No members yet. Add a contact with the Member role."
      />
    </>
  )
}
