import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { ContactsSettingsClient } from "@/components/contacts/contacts-settings-client"
import { getDiscountTags } from "@/lib/discount-tags/discount-tag-queries"

export default async function DirectorySettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  if (tab) {
    redirect("/directory/settings")
  }

  const tags = await getDiscountTags()

  return (
    <>
      <Header title="Directory Settings" />
      <ContactsSettingsClient tags={tags} />
    </>
  )
}
