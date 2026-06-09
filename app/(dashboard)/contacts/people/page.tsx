import { Header } from "@/components/layout/header"
import { ContactsCrmList } from "@/components/contacts/contacts-crm-list"
import { ContactsIntroCopy } from "@/components/contacts/contacts-intro-copy"

export default function ContactsPeoplePage() {
  return (
    <>
      <Header title="People" />
      <ContactsCrmList
        lockedRecordType="individual"
        intro={<ContactsIntroCopy variant="people" />}
      />
    </>
  )
}
