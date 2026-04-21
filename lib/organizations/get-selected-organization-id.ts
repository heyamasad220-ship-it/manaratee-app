import { cookies } from "next/headers"

export async function getSelectedOrganizationId() {
  const cookieStore = await cookies()
  return cookieStore.get("selected_organization_id")?.value || null
}