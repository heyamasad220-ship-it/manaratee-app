import { Header } from "@/components/layout/header"
import { ContactsCrmList } from "@/components/contacts/contacts-crm-list"

export default function ContactsGroupsPage() {
  return (
    <>
      <Header title="Groups" />
      <ContactsCrmList lockedRecordType="group" showStats={false} />
    </>
  )
}
