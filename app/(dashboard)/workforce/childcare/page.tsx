import { Header } from "@/components/layout/header"
import { HrChildcarePanel } from "@/components/hr/hr-childcare-panel"
import { ModuleApplicationsLink } from "@/components/applications/module-applications-link"
import { fetchChildcareProvidersData } from "@/lib/hr/childcare-provider-actions"

export default async function HrChildcarePage() {
  const { providers, stats } = await fetchChildcareProvidersData()

  return (
    <div className="flex flex-1 flex-col">
      <Header
        title="Child Care Providers"
        actions={
          <ModuleApplicationsLink
            applicationType="childcare_provider"
            label="Provider Applications"
          />
        }
      />
      <HrChildcarePanel providers={providers} stats={stats} />
    </div>
  )
}
