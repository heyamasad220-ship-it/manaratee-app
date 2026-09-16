import { Header } from "@/components/layout/header"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { redirectOrgWideProgramPagesForDepartmentHead } from "@/lib/programs/program-access"
import { getOpenPrograms } from "@/lib/programs/program-queries"
import { createClient } from "@/lib/supabase/server"

async function countActiveOfferings() {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return 0

  const { count, error } = await supabase
    .from("program_offerings")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .neq("status", "archived")

  if (error) {
    console.error("[programs home] offering count", error)
    return 0
  }
  return count ?? 0
}

export default async function ProgramsHomePage() {
  await redirectOrgWideProgramPagesForDepartmentHead()
  const [programs, offeringCount] = await Promise.all([
    getOpenPrograms(),
    countActiveOfferings(),
  ])

  const metrics = [
    {
      label: "Programs",
      value: programs.length,
      hint: "Years and seasons",
    },
    {
      label: "Offerings",
      value: offeringCount,
      hint: "Classes families can register for",
    },
  ]

  return (
    <>
      <Header title="Overview" />
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A snapshot of programs and offerings across the organization.
          </p>
        </div>

        <StatCardsRow>
          {metrics.map((metric) => (
            <StatCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              hint={metric.hint}
            />
          ))}
        </StatCardsRow>
      </div>
    </>
  )
}
