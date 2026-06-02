"use client"

import { useSearchParams } from "next/navigation"
import { ApplicationsListView } from "@/components/applications/applications-list-view"
import type { ApplicationStatus, ModuleOwner } from "@/lib/applications/application-types"

export function ApplicationsFilteredPage({
  defaultStatus,
  title,
  description,
}: {
  defaultStatus?: ApplicationStatus | ApplicationStatus[]
  title?: string
  description?: string
}) {
  const searchParams = useSearchParams()
  const applicationType = searchParams.get("application_type") ?? undefined
  const moduleOwner = (searchParams.get("module_owner") as ModuleOwner | null) ?? undefined

  return (
    <ApplicationsListView
      title={title}
      description={description}
      initialStatus={defaultStatus}
      initialApplicationType={applicationType}
      initialModuleOwner={moduleOwner}
      hideTypeFilter={Boolean(applicationType)}
      hideModuleFilter={Boolean(moduleOwner)}
    />
  )
}
