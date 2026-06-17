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
          <div>
            <p className="text-sm font-medium text-blue-800">Configure automatic affiliations</p>
            <p className="text-sm text-blue-700">
              Turn activity-based affiliations on or off for your organization. Defaults follow your
              subscribed modules — for example, a venue-rentals org can leave Donor off when
              Donations is not enabled. Staff can still add or remove affiliations manually on
              contact profiles.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Automatic affiliations</CardTitle>
          <CardDescription>
            When auto-sync is on, module activity adds the affiliation tag. Manual edits on a
            contact profile are preserved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Affiliation</TableHead>
                <TableHead>Triggered by</TableHead>
                <TableHead>Auto-add</TableHead>
                <TableHead>Auto-remove</TableHead>
                <TableHead>Module</TableHead>
                <TableHead className="text-right">Auto-sync</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settings.map((row) => {
                const switchId = `affiliation-auto-sync-${row.role}`

                return (
                  <TableRow key={row.role}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    <TableCell className="max-w-xs text-muted-foreground">{row.trigger}</TableCell>
                    <TableCell>{row.autoAdd}</TableCell>
                    <TableCell>
                      {row.autoRemove.startsWith("Never") ? (
                        <Badge variant="secondary">{row.autoRemove}</Badge>
                      ) : (
                        row.autoRemove
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div>{row.moduleList}</div>
                      {!row.moduleAvailable ? (
                        <p className="mt-1 text-xs text-amber-700">Module not enabled</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
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
            provider labels remain manual on the contact profile.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
