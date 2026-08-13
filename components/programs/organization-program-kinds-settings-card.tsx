"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ORGANIZATION_PROGRAM_KINDS_OPTIONS } from "@/lib/programs/program-kind-policy"
import type { OrganizationProgramKindsEntitlement } from "@/lib/programs/program-kind-policy"

export function OrganizationProgramKindsSettingsCard({
  value,
  onSave,
  title = "Program modes",
  description = "Which program create modes this organization may use (Academic years, Seasonal camps, or both).",
  saveLabel = "Save program modes",
}: {
  value: OrganizationProgramKindsEntitlement
  onSave: (
    next: OrganizationProgramKindsEntitlement
  ) => Promise<{ success: true } | { success: false; error: string }>
  title?: string
  description?: string
  saveLabel?: string
}) {
  const [selected, setSelected] =
    React.useState<OrganizationProgramKindsEntitlement>(value)
  const [saving, setSaving] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setSelected(value)
  }, [value])

  const selectedOption =
    ORGANIZATION_PROGRAM_KINDS_OPTIONS.find((option) => option.value === selected) ||
    ORGANIZATION_PROGRAM_KINDS_OPTIONS[0]

  async function handleSave() {
    setSaving(true)
    setError(null)
    setMessage(null)
    const result = await onSave(selected)
    setSaving(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    setMessage("Program modes saved.")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-md space-y-2">
          <Label htmlFor="org-program-kinds">Allowed modes</Label>
          <Select
            value={selected}
            onValueChange={(next) =>
              setSelected(next as OrganizationProgramKindsEntitlement)
            }
          >
            <SelectTrigger id="org-program-kinds">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORGANIZATION_PROGRAM_KINDS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {selectedOption.description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || selected === value}
          >
            {saving ? "Saving…" : saveLabel}
          </Button>
          {message ? (
            <p className="text-sm text-emerald-700">{message}</p>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      </CardContent>
    </Card>
  )
}
