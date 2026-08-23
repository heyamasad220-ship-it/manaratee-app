import { Header } from "@/components/layout/header"
import { ContactsCrmList } from "@/components/contacts/contacts-crm-list"
import { isDirectoryFacilitiesEnabled } from "@/lib/directory/directory-nav-summary"

export default async function DirectoryOrganizationsPage() {
  const facilitiesEnabled = await isDirectoryFacilitiesEnabled()

  return (
    <>
      <Header title="Organizations" />
      <ContactsCrmList
        lockedRecordType="organization"
        showStats={false}
        facilitiesEnabled={facilitiesEnabled}
        emptyTitle="No organizations yet"
        emptyDescription="Add businesses, partners, sponsors, vendors, and other organizations to your directory."
      />
    </>
  )
}
