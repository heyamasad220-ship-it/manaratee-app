import { redirect } from "next/navigation"
import { MEMBERSHIP_BENEFITS_PATH } from "@/lib/memberships/membership-module-label"

export default function HrDiscountTagsRedirectPage() {
  redirect(MEMBERSHIP_BENEFITS_PATH)
}
