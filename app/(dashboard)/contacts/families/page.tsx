import { redirect } from "next/navigation"

/** Families directory moved under Contacts → Reports. */
export default function ContactsFamiliesPage() {
  redirect("/contacts/reports/directory?tab=families")
}
