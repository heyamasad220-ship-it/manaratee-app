"use client"

import { useTransition } from "react"
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
        const message = error instanceof Error ? error.message : "Could not save role setting."
        alert(message)
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Automatic roles</CardTitle>
          <CardDescription>
            Defaults follow your subscribed modules. Turning auto-sync off prevents new automatic
            roles; it does not remove roles already on contacts.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="min-w-[920px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Role</TableHead>
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
