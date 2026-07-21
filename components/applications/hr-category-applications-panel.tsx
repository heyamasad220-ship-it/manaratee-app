"use client"

import { ApplicationsModulePage } from "@/components/applications/applications-module-page"

export function HrCategoryApplicationsPanel({
  applicationType,
  syncPath,
  title = "Applications",
  description = "Review and manage submissions for this category.",
}: {
  applicationType: string
  syncPath: string
  title?: string
  description?: string
}) {
  return (
    <ApplicationsModulePage
      moduleOwner="workforce"
      basePath={syncPath}
      title={title}
      description={description}
      lockedApplicationType={applicationType}
      embedded
      embeddedSyncPath={syncPath}
      section="submissions"
      hidePageHeader
      pageTab="submissions"
    />
  )
}
