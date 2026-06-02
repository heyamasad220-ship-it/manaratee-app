import { Header } from "@/components/layout/header"
import { ContactsCrmList } from "@/components/contacts/contacts-crm-list"

export default function ContactsPeoplePage() {
  return (
    <>
      <Header title="People" />
      <ContactsCrmList lockedRecordType="individual" />
    </>
  )
}
