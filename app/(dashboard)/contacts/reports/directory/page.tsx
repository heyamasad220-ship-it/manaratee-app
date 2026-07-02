import { Header } from "@/components/layout/header"
import { ContactsDirectoryReportPanel } from "@/components/contacts/contacts-directory-report-panel"
import { CONTACTS_MODULE_LABEL } from "@/lib/contacts/contact-module-label"

export default function ContactsDirectoryReportPage() {
  return (
    <>
      <Header title={`${CONTACTS_MODULE_LABEL} Directory`} />
      <ContactsDirectoryReportPanel />
    </>
  )
}
