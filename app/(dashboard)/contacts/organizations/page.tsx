import { Header } from "@/components/layout/header"
import { ContactsCrmList } from "@/components/contacts/contacts-crm-list"

export default function ContactsOrganizationsPage() {
  return (
    <>
      <Header title="Organizations" />
      <ContactsCrmList lockedRecordType="organization" />
    </>
  )
}
