import { redirect } from "next/navigation"

function getValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

/** Former Dashboard — merged into Overview (`/event-management`). */
export default async function EventManagementOverviewRedirectPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const resolved = await searchParams
  const params = new URLSearchParams()

  for (const key of ["period", "q", "status", "department", "eventType", "view"]) {
    const value = getValue(resolved?.[key])
    if (value) params.set(key, value)
  }

  const query = params.toString()
  redirect(query ? `/event-management?${query}` : "/event-management")
}
