import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import { donationGroupHref } from "@/lib/donations/donation-group-path"

export function getDonorProfilePath(
  donorId: string,
  donorType?: string | null,
  contactId?: string | null,
  returnTo?: string | null,
  options?: { contactType?: string | null }
) {
  if (contactId) {
    if (options?.contactType === "group") {
      return donationGroupHref(contactId, {
        tab: "financial",
        returnTo: returnTo ?? undefined,
      })
    }
    return contactProfileHref(contactId, {
      tab: "financial",
      returnTo: returnTo ?? undefined,
    })
  }

  const segment = donorType === "organization" ? "organizations" : "individuals"
  return `/donations/donors/${segment}/${donorId}`
}
