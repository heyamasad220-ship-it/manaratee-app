import { Header } from "@/components/layout/header"
import { ContactsCrmList } from "@/components/contacts/contacts-crm-list"

export default function DirectoryPeoplePage() {
  return (
    <>
      <Header title="People" />
      <ContactsCrmList
        lockedRecordType="individual"
        showStats={false}
        emptyTitle="No people yet"
        emptyDescription="Add people to your directory. One person can have many roles without creating duplicate records."
      />
    </>
  )
}
