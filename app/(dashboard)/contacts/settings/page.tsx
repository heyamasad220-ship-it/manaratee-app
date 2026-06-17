import { Header } from "@/components/layout/header"
import { ContactsSettingsClient } from "@/components/contacts/contacts-settings-client"
import { CONTACTS_MODULE_LABEL } from "@/lib/contacts/contact-module-label"
import { getOrganizationAffiliationSettings } from "@/lib/contacts/contact-affiliation-settings"
import { getDiscountTags } from "@/lib/discount-tags/discount-tag-queries"

export default async function ContactsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const [tags, affiliationSettings] = await Promise.all([
    getDiscountTags(),
    getOrganizationAffiliationSettings(),
  ])

  return (
    <>
      <Header title={`${CONTACTS_MODULE_LABEL} Settings`} />
      <ContactsSettingsClient
        tags={tags}
        affiliationSettings={affiliationSettings}
        initialTab={tab}
      />
    </>
  )
}
