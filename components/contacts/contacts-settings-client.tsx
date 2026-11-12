"use client"

import { DiscountPoliciesPanel } from "@/components/hr/discount-policies-panel"
import type { DiscountTag } from "@/lib/discount-tags/discount-tag-types"

export function ContactsSettingsClient({ tags }: { tags: DiscountTag[] }) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Discount tags for this organization. Each organization names its own tags.
        </p>
      </div>

      <DiscountPoliciesPanel tags={tags} />
    </div>
  )
}
