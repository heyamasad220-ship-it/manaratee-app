"use client"

import Link from "next/link"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { RoomSetupStyle } from "@/lib/setup-styles/setup-style-types"

type SetupStyleFieldProps = {
  id?: string
  label?: string
  value: string
  setupStyles: RoomSetupStyle[]
  onChange: (value: string) => void
  canManage?: boolean
  required?: boolean
}

export function SetupStyleField({
  id = "setup_style",
  label = "Setup style",
  value,
  setupStyles,
  onChange,
  canManage = false,
  required = false,
}: SetupStyleFieldProps) {
  const selectedStyle = setupStyles.find((style) => style.name === value)
  const selectValue = selectedStyle?.name || (value ? value : undefined)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>
          {label}
          {required ? <span className="text-destructive"> *</span> : null}
        </Label>
        {canManage ? (
          <Link
            href="/event-management/settings/setup-styles"
            className="text-xs font-medium text-primary hover:underline"
          >
            Manage
          </Link>
        ) : null}
      </div>

      {setupStyles.length > 0 ? (
        <Select
          value={selectValue}
          onValueChange={onChange}
          required={required}
        >
          <SelectTrigger id={id} className="w-full bg-background">
            <SelectValue placeholder="Select setup style" />
          </SelectTrigger>
          <SelectContent>
            {setupStyles.map((style) => (
              <SelectItem key={style.id} value={style.name}>
                {style.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          required={required}
        >
          <option value="">Select setup style</option>
        </select>
      )}

      {setupStyles.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {canManage
            ? "No setup styles yet. Add styles in settings."
            : "Ask an administrator to configure setup styles."}
        </p>
      ) : null}
    </div>
  )
}
