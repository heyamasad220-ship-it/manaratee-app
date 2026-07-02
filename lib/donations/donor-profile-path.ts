import { contactProfileHref } from "@/lib/contacts/contact-profile-path"

export function getDonorProfilePath(
  donorId: string,
  donorType?: string | null,
  contactId?: string | null,
  returnTo?: string | null
) {
  if (contactId) {
    return contactProfileHref(contactId, {
      tab: "financial",
      returnTo: returnTo ?? undefined,
    })
  }

  const segment = donorType === "organization" ? "organizations" : "individuals"
  return `/donations/donors/${segment}/${donorId}`
}
