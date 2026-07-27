"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AffiliationRulesPanel } from "@/components/contacts/affiliation-rules-panel"
import { DiscountPoliciesPanel } from "@/components/hr/discount-policies-panel"
import type { OrganizationAffiliationSettingRow } from "@/lib/contacts/contact-affiliation-settings"
import type { DiscountTag } from "@/lib/discount-tags/discount-tag-types"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tags, Users } from "lucide-react"

const settingsTabs = ["affiliations", "discount-tags"] as const

type ContactsSettingsTab = (typeof settingsTabs)[number]

function normalizeTab(tab?: string | null): ContactsSettingsTab {
  if (tab === "benefits") return "discount-tags"
  if (tab === "roles") return "affiliations"
  if (tab && settingsTabs.includes(tab as ContactsSettingsTab)) {
    return tab as ContactsSettingsTab
  }
  return "affiliations"
}

export function ContactsSettingsClient({
  tags,
  affiliationSettings,
  initialTab,
}: {
  tags: DiscountTag[]
  affiliationSettings: OrganizationAffiliationSettingRow[]
  initialTab?: string | null
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = React.useState<ContactsSettingsTab>(normalizeTab(initialTab))

  React.useEffect(() => {
    setActiveTab(normalizeTab(initialTab))
  }, [initialTab])

  function handleTabChange(value: string) {
    const tab = normalizeTab(value)
    setActiveTab(tab)
    router.replace(`/contacts/settings?tab=${tab}`, { scroll: false })
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Role auto-tagging rules, eligibility tags, and related configuration.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList>
          <TabsTrigger value="affiliations" className="gap-2">
            <Users className="size-4" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="discount-tags" className="gap-2">
            <Tags className="size-4" />
            Discount Tags
          </TabsTrigger>
        </TabsList>

        <TabsContent value="affiliations" className="mt-0">
          <AffiliationRulesPanel settings={affiliationSettings} />
        </TabsContent>

        <TabsContent value="discount-tags" className="mt-0">
          <DiscountPoliciesPanel tags={tags} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
