import { Header } from "@/components/layout/header"
import { ContactsCrmList } from "@/components/contacts/contacts-crm-list"
import { ContactsIntroCopy } from "@/components/contacts/contacts-intro-copy"

export default function ContactsOrganizationsPage() {
  return (
    <>
      <Header title="Organizations" />
      <ContactsCrmList
        lockedRecordType="organization"
        intro={<ContactsIntroCopy variant="organizations" />}
      />
    </>
  )
}
