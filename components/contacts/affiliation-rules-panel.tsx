"use client"

import { useTransition } from "react"
import { Info } from "lucide-react"
import type { OrganizationAffiliationSettingRow } from "@/lib/contacts/contact-affiliation-settings"
import { setOrganizationAffiliationAutoSync } from "@/lib/contacts/contact-affiliation-settings"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function formatAutoRemove(value: string) {
  if (value.startsWith("Never")) {
    return { short: "Never (sticky)", full: value }
  }
  return { short: value, full: value }
}

export function AffiliationRulesPanel({
  settings,
}: {
  settings: OrganizationAffiliationSettingRow[]
}) {
  const [isPending, startTransition] = useTransition()

  function handleToggle(row: OrganizationAffiliationSettingRow, checked: boolean) {
    startTransition(async () => {
      try {
        await setOrganizationAffiliationAutoSync(row.role, checked)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not save affiliation setting."
        alert(message)
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="flex items-start gap-3 p-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
          <div className="space-y-2 text-sm text-blue-700">
            <p className="font-medium text-blue-800">How affiliation settings work</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>This page</strong> turns automatic tagging on or off per affiliation type.
                There is no add/edit for custom types — these rules are built into Manaratee.
              </li>
              <li>
                <strong>Remove a tag from one person:</strong> open their contact profile →{" "}
                <strong>Affiliations</strong> → <strong>Edit affiliations</strong>, uncheck the
                tag, and save.
              </li>
              <li>
                <strong>Stop future auto-tagging:</strong> turn <strong>Auto-sync</strong> off here
                (for example, turn Donor off if you only use venue rentals).
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Automatic affiliations</CardTitle>
          <CardDescription>
            Defaults follow your subscribed modules. Turning auto-sync off prevents new automatic
            tags; it does not remove tags already on contacts.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="min-w-[920px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Affiliation</TableHead>
                <TableHead className="w-[240px]">Triggered by</TableHead>
                <TableHead className="w-[150px]">Auto-add</TableHead>
                <TableHead className="w-[150px]">Auto-remove</TableHead>
                <TableHead className="w-[170px]">Module</TableHead>
                <TableHead className="w-[90px] text-right">Auto-sync</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settings.map((row) => {
                const switchId = `affiliation-auto-sync-${row.role}`
                const autoRemove = formatAutoRemove(row.autoRemove)

                return (
                  <TableRow key={row.role}>
                    <TableCell className="align-top font-medium whitespace-normal break-words">
                      {row.label}
                    </TableCell>
                    <TableCell className="align-top whitespace-normal break-words text-muted-foreground">
                      {row.trigger}
                    </TableCell>
                    <TableCell className="align-top whitespace-normal break-words">
                      {row.autoAdd}
                    </TableCell>
                    <TableCell className="align-top whitespace-normal break-words">
                      {autoRemove.short.startsWith("Never") ? (
                        <Badge variant="secondary" title={autoRemove.full}>
                          {autoRemove.short}
                        </Badge>
                      ) : (
                        <span title={autoRemove.full}>{autoRemove.short}</span>
                      )}
                    </TableCell>
                    <TableCell className="align-top whitespace-normal break-words text-muted-foreground">
                      <div>{row.moduleList}</div>
                      {!row.moduleAvailable ? (
                        <p className="mt-1 text-xs text-amber-700">Module not enabled</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="align-top text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Label htmlFor={switchId} className="sr-only">
                          Auto-sync {row.label}
                        </Label>
                        <Switch
                          id={switchId}
                          checked={row.autoSyncEnabled}
                          disabled={isPending || (!row.moduleAvailable && !row.autoSyncEnabled)}
                          onCheckedChange={(checked) => handleToggle(row, checked)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Organizations</CardTitle>
          <CardDescription>
            Organization contacts use the same auto-sync toggles as people. Customer and service
            provider labels are edited on each contact profile, not on this page.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
