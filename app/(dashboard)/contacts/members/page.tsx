import { redirect } from "next/navigation"
import { MEMBERSHIP_MEMBERS_PATH } from "@/lib/memberships/membership-module-label"

export default function ContactsMembersRedirectPage() {
  redirect(MEMBERSHIP_MEMBERS_PATH)
}
