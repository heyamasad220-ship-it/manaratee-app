import { redirect } from "next/navigation"
import { MEMBERSHIP_MEMBERS_PATH } from "@/lib/memberships/membership-module-label"

export default function HrMembersRedirectPage() {
  redirect(MEMBERSHIP_MEMBERS_PATH)
}
