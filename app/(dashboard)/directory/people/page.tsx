import { Header } from "@/components/layout/header"
import { ContactsCrmList } from "@/components/contacts/contacts-crm-list"
import { isDirectoryFacilitiesEnabled } from "@/lib/directory/directory-nav-summary"

export default async function DirectoryPeoplePage() {
  const facilitiesEnabled = await isDirectoryFacilitiesEnabled()

  return (
    <>
      <Header title="People" />
      <ContactsCrmList
        lockedRecordType="individual"
        showStats={false}
        facilitiesEnabled={facilitiesEnabled}
        emptyTitle="No people yet"
        emptyDescription="Add people to your directory. One person can have many roles without creating duplicate records."
      />
    </>
  )
}
