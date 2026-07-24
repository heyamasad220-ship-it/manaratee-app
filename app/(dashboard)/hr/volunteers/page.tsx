import { Suspense } from "react"
import { Header } from "@/components/layout/header"
import { VolunteersList } from "@/components/workforce/volunteers-list"
import { ModuleApplicationsLink } from "@/components/applications/module-applications-link"

export default function HrVolunteersPage() {
  return (
    <>
      <Header
        title="Volunteers"
        actions={<ModuleApplicationsLink applicationType="volunteer" label="Volunteer Applications" />}
      />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted" />}>
        <VolunteersList />
      </Suspense>
    </>
  )
}
