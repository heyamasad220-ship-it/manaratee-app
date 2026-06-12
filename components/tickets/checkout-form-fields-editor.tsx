"use client"

import {
  AlignLeft,
  Eye,
  EyeOff,
  GripVertical,
  Hash,
  ListChecks,
  Mail,
  MapPin,
  Phone,
  Plus,
  ToggleLeft,
  User,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { CheckoutFormField } from "@/lib/tickets/ticketing-checkout-ui-types"

const fieldIcons: Record<string, LucideIcon> = {
  text: User,
  email: Mail,
  phone: Phone,
  address: MapPin,
  textarea: AlignLeft,
  select: ListChecks,
  checkbox: ToggleLeft,
  number: Hash,
}

type CheckoutFormFieldsEditorProps = {
  fields: CheckoutFormField[]
  onChange: (fields: CheckoutFormField[]) => void
  onAddField?: () => void
  showAddField?: boolean
  compact?: boolean
}

export function CheckoutFormFieldsEditor({
  fields,
  onChange,
  onAddField,
  showAddField = true,
  compact = false,
}: CheckoutFormFieldsEditorProps) {
  function toggleFieldEnabled(fieldId: string) {
    onChange(
      fields.map((field) =>
        field.id === fieldId ? { ...field, enabled: !field.enabled } : field
      )
    )
  }

  function toggleFieldRequired(fieldId: string) {
    onChange(
      fields.map((field) =>
        field.id === fieldId ? { ...field, required: !field.required } : field
      )
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {fields.map((field) => {
        const Icon = fieldIcons[field.type] || User

        return (
          <div
            key={field.id}
            className={`flex items-center gap-4 rounded-lg border transition-colors ${
              compact ? "p-3" : "p-4"
            } ${field.enabled ? "bg-background" : "bg-muted/50 opacity-60"}`}
          >
            {!compact ? (
              <GripVertical className="h-5 w-5 cursor-grab text-muted-foreground" />
            ) : null}
            <div
              className={`flex items-center justify-center rounded-lg bg-primary/10 ${
                compact ? "h-8 w-8" : "h-10 w-10"
              }`}
            >
              <Icon className={`text-primary ${compact ? "h-4 w-4" : "h-5 w-5"}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={compact ? "text-sm font-medium" : "font-medium"}>
                  {field.name}
                </span>
                {field.required && field.enabled ? (
                  <Badge variant="secondary" className="text-xs">
                    Required
                  </Badge>
                ) : null}
              </div>
              <span className="text-xs capitalize text-muted-foreground">
                {field.type} field
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor={`required-${field.id}`}
                  className="text-xs text-muted-foreground"
                >
                  Required
                </Label>
                <Switch
                  id={`required-${field.id}`}
                  checked={field.required}
                  onCheckedChange={() => toggleFieldRequired(field.id)}
                  disabled={!field.enabled}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleFieldEnabled(field.id)}
              >
                {field.enabled ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )
      })}

      {showAddField && onAddField ? (
        <Button variant="outline" onClick={onAddField}>
          <Plus className="mr-2 h-4 w-4" />
          Add Custom Field
        </Button>
      ) : null}
    </div>
  )
}
