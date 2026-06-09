import { Header } from "@/components/layout/header"
import { ContactsCrmList } from "@/components/contacts/contacts-crm-list"
import { ContactsIntroCopy } from "@/components/contacts/contacts-intro-copy"

export default function ContactsPage() {
  return (
    <>
      <Header title="All Contacts" />
      <ContactsCrmList intro={<ContactsIntroCopy />} />
    </>
  )
}
