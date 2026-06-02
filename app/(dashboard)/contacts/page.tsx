import { Header } from "@/components/layout/header"
import { ContactsCrmList } from "@/components/contacts/contacts-crm-list"

export default function ContactsPage() {
  return (
    <>
      <Header title="All Contacts" />
      <ContactsCrmList />
    </>
  )
}
