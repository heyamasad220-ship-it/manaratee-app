import { redirect } from "next/navigation"

import { ContactsReportsChrome } from "@/components/contacts/contacts-reports-chrome"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
import { hasPermission } from "@/lib/permissions/permissions"

export default async function ContactsReportsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const allowed = await hasPermission(PERMISSIONS.CONTACTS_VIEW)
  if (!allowed) {
    redirect("/dashboard")
  }

  return <ContactsReportsChrome>{children}</ContactsReportsChrome>
}
