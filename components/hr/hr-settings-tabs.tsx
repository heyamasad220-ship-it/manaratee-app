import type { ReactNode } from "react"
import { PEOPLE_MANAGEMENT_MODULE_LABEL } from "@/lib/hr/hr-module-label"

export function HRSettingsTabs({ discountPoliciesPanel }: { discountPoliciesPanel: ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage {PEOPLE_MANAGEMENT_MODULE_LABEL.toLowerCase()} configuration for your organization.
        </p>
      </div>

      {discountPoliciesPanel}
    </div>
  )
}
