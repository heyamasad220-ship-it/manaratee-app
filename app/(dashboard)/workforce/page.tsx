import { Header } from "@/components/layout/header"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import { Baby, HeartHandshake, Users } from "lucide-react"
import { fetchPeopleManagementOverview } from "@/lib/hr/hr-overview-actions"
import { PEOPLE_MANAGEMENT_MODULE_LABEL } from "@/lib/hr/hr-module-label"

export default async function WorkforceOverviewPage() {
  const overview = await fetchPeopleManagementOverview()

  const stats = [
    {
      label: "Total Employees",
      value: overview.employees.totalEmployees,
      icon: Users,
    },
    {
      label: "Total Volunteers",
      value: overview.volunteerContacts,
      icon: HeartHandshake,
    },
    {
      label: "Total Childcare Providers",
      value: overview.childcareProviders,
      icon: Baby,
    },
  ]

  return (
    <>
      <Header title={PEOPLE_MANAGEMENT_MODULE_LABEL} />
      <div className="p-6">
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
            <p className="text-sm text-muted-foreground">
              Workforce headcount at a glance.
            </p>
          </div>

          <StatCardsRow>
            {stats.map((stat) => (
              <StatCard
                key={stat.label}
                label={stat.label}
                value={stat.value}
                icon={stat.icon}
              />
            ))}
          </StatCardsRow>
        </div>
      </div>
    </>
  )
}
