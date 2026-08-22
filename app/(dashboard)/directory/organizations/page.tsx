import { Header } from "@/components/layout/header"
import { ContactsCrmList } from "@/components/contacts/contacts-crm-list"

export default function DirectoryOrganizationsPage() {
  return (
    <>
      <Header title="Organizations" />
      <ContactsCrmList
        lockedRecordType="organization"
        showStats={false}
        emptyTitle="No organizations yet"
        emptyDescription="Add businesses, partners, sponsors, vendors, and other organizations to your directory."
      />
    </>
  )
}
