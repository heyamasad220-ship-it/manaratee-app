import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

async function repairLegacyDepartments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  userId: string | undefined
) {
  if (!userId) {
    return
  }

  // Departments created before the org-id fix were saved with auth user id.
  const { error } = await supabase
    .from("departments")
    .update({ organization_id: organizationId })
    .eq("organization_id", userId)

  if (error) {
    console.error("Failed to repair legacy departments:", error)
  }
}

export async function getDepartments() {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return []
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  await repairLegacyDepartments(supabase, organizationId, user?.id)

  let { data, error } = await supabase
    .from("departments")
    .select("*")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true })

  if (error) {
    console.error(error)
    throw new Error("Failed to load departments")
  }

  let departments = data || []

  // If nothing matched, repair visible legacy rows and reload once.
  if (departments.length === 0) {
    const { data: visibleDepartments, error: visibleError } = await supabase
      .from("departments")
      .select("id")
      .order("name", { ascending: true })

    if (!visibleError && visibleDepartments?.length) {
      const { error: repairError } = await supabase
        .from("departments")
        .update({ organization_id: organizationId })
        .in(
          "id",
          visibleDepartments.map((department) => department.id)
        )

      if (repairError) {
        console.error("Failed to repair visible departments:", repairError)
      } else {
        const reload = await supabase
          .from("departments")
          .select("*")
          .eq("organization_id", organizationId)
          .order("name", { ascending: true })

        if (reload.error) {
          console.error(reload.error)
          throw new Error("Failed to load departments")
        }

        departments = reload.data || []
      }
    }
  }

  return departments
}