"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Bell, Settings, Ticket } from "lucide-react"

import { DepartmentProgramOverviewPanel } from "@/components/departments/department-program-overview-panel"
import { DepartmentPromoCodesSettingsPanel } from "@/components/departments/department-promo-codes-settings-panel"
import { ProgramDefaultsSettingsPanel } from "@/components/programs/program-defaults-settings-panel"
import { ProgramPolicySettingsPanel } from "@/components/programs/program-policy-settings-panel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { YEAR_SEASON_LABEL } from "@/lib/programs/program-display-labels"
import type { Program } from "@/lib/programs/program-types"
import {
  parseProgramSettingsSection,
  programWorkspaceHref,
} from "@/lib/programs/program-workspace-path"

export function ProgramWorkspaceSettingsPanel({
  program,
  departmentId,
  onProgramMetaChanged,
}: {
  program: Program
  departmentId: string
  onProgramMetaChanged?: () => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const section = parseProgramSettingsSection(searchParams.get("section"))

  function handleSectionChange(nextSection: string) {
    const parsed = parseProgramSettingsSection(nextSection)
    router.replace(
      programWorkspaceHref(program.id, {
        tab: "settings",
        settingsSection: parsed,
      }),
      { scroll: false }
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Name, dates, enrollment, and registration rules for this{" "}
          {YEAR_SEASON_LABEL.toLowerCase()}.
        </p>
      </div>

      <Tabs
        value={section}
        onValueChange={handleSectionChange}
        className="space-y-6"
      >
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="general" className="gap-2">
            <Settings className="size-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="size-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="promo-codes" className="gap-2">
            <Ticket className="size-4" />
            Promo Codes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <div className="space-y-8">
            <DepartmentProgramOverviewPanel
              departmentId={departmentId}
              yearProgramId={program.id}
              hideChrome
              hideEligibility
              onProgramMetaChanged={onProgramMetaChanged}
            />
            <ProgramDefaultsSettingsPanel
              program={program}
              hideDates
              hideIntro
            />
            <ProgramPolicySettingsPanel
              departmentId={departmentId}
              section="registration"
              omitRepeatedFields
            />
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <ProgramPolicySettingsPanel
            departmentId={departmentId}
            section="notifications"
          />
        </TabsContent>

        <TabsContent value="promo-codes">
          <DepartmentPromoCodesSettingsPanel
            departmentId={departmentId}
            programId={program.id}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
