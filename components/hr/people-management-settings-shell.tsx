import type { ReactNode } from "react"

import { PEOPLE_MANAGEMENT_MODULE_LABEL } from "@/lib/hr/hr-module-label"

import { PeopleManagementSettingsNav } from "./people-management-settings-nav"

export function PeopleManagementSettingsShell({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold">Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage {PEOPLE_MANAGEMENT_MODULE_LABEL.toLowerCase()} configuration for your
          organization.
        </p>
      </div>

      <PeopleManagementSettingsNav />

      {children}
    </div>
  )
}
