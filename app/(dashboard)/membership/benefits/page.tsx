import { redirect } from "next/navigation"
import { CONTACTS_BENEFITS_PATH } from "@/lib/contacts/contact-module-label"

export default function MembershipBenefitsRedirectPage() {
  redirect(CONTACTS_BENEFITS_PATH)
}
