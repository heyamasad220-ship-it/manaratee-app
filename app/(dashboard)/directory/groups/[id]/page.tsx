import { redirect } from "next/navigation"

import { donationGroupHref } from "@/lib/donations/donation-group-path"

export default async function DirectoryGroupDetailRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(donationGroupHref(id))
}
