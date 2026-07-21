import { Suspense } from "react"
import { Header } from "@/components/layout/header"
import { HrChildcarePanel } from "@/components/hr/hr-childcare-panel"
import { fetchChildcareProvidersData } from "@/lib/hr/childcare-provider-actions"

export default async function HrChildcarePage() {
  const { providers, stats } = await fetchChildcareProvidersData()

  return (
    <div className="flex flex-1 flex-col">
      <Header title="Childcare Providers" />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted" />}>
        <HrChildcarePanel providers={providers} stats={stats} />
      </Suspense>
    </div>
  )
}
