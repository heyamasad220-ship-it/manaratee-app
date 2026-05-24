import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { InstructorsClient } from "./instructors-client"

export default async function InstructorsPage() {
  const organizationId = await getSelectedOrganizationId()

  return <InstructorsClient organizationId={organizationId} />
}