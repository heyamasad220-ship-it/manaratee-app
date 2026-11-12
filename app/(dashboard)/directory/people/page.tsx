import { redirect } from "next/navigation"

import { directoryContactsTabPath } from "@/lib/directory/directory-paths"

export default async function DirectoryPeoplePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (key === "tab" || typeof value !== "string") continue
    query.set(key, value)
  }
  const extra = query.toString()
  redirect(extra ? `${directoryContactsTabPath("people")}&${extra}` : directoryContactsTabPath("people"))
}
