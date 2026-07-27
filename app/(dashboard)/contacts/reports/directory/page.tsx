import { Suspense } from "react"

import { Header } from "@/components/layout/header"
import { ContactsDirectoryReportPanel } from "@/components/contacts/contacts-directory-report-panel"
import { CONTACTS_MODULE_LABEL } from "@/lib/contacts/contact-module-label"

export default function ContactsDirectoryReportPage() {
  return (
    <>
      <Header title={`${CONTACTS_MODULE_LABEL} Directory`} />
      <Suspense
        fallback={
          <div className="p-6 text-sm text-muted-foreground">Loading directory...</div>
        }
      >
        <ContactsDirectoryReportPanel />
      </Suspense>
    </>
  )
}
