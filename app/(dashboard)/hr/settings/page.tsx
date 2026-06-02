import { Header } from "@/components/layout/header"
import { DiscountPoliciesPanel } from "@/components/hr/discount-policies-panel"
import { HRSettingsTabs } from "@/components/hr/hr-settings-tabs"
import { getDiscountTags } from "@/lib/discount-tags/discount-tag-queries"
import { redirect } from "next/navigation"

export default async function HRSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams

  if (tab === "teams") {
    redirect("/hr/teams?tab=teams")
  }

  if (tab === "team-positions") {
    redirect("/hr/teams?tab=positions")
  }

  if (tab === "departments") {
    redirect("/hr/employees?tab=departments")
  }

  if (tab === "positions") {
    redirect("/hr/employees?tab=positions")
  }

  if (tab === "time-off" || tab === "work-schedule" || tab === "notifications") {
    redirect("/hr/employees?tab=overview")
  }

  if (tab === "general" || tab === "roles" || tab === "discount-policies") {
    redirect("/hr/settings")
  }

  const tags = await getDiscountTags()

  return (
    <>
      <Header title="Settings" />
      <div className="p-6">
        <HRSettingsTabs discountPoliciesPanel={<DiscountPoliciesPanel tags={tags} />} />
      </div>
    </>
  )
}
