"use client"

import { useMemo, useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  emptyVendorApplicationFormValues,
  getEnabledVendorApplicationFields,
  VENDOR_APPLICATION_SECTION_LABELS,
  type VendorApplicationFieldDef,
  type VendorApplicationFieldSection,
  type VendorApplicationFormValues,
} from "@/lib/vendor-hub/vendor-application-fields"
import type { VendorHubVendorType } from "@/lib/vendor-hub/vendor-type-types"

const SECTION_ORDER: VendorApplicationFieldSection[] = [
  "contact",
  "business",
  "social",
  "offerings",
  "additional",
]

type VendorApplicationFormProps = {
  initialValues?: Partial<VendorApplicationFormValues>
  vendorTypes: VendorHubVendorType[]
  onSubmit: (values: VendorApplicationFormValues) => void
  onCancel?: () => void
  isSubmitting?: boolean
}

export function VendorApplicationForm({
  initialValues,
  vendorTypes,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: VendorApplicationFormProps) {
  const [values, setValues] = useState(() => emptyVendorApplicationFormValues(initialValues))
  const [error, setError] = useState<string | null>(null)

  const fieldsBySection = useMemo(() => {
    const enabled = getEnabledVendorApplicationFields()
    const map = new Map<VendorApplicationFieldSection, VendorApplicationFieldDef[]>()
    for (const section of SECTION_ORDER) {
      map.set(
        section,
        enabled.filter((field) => field.section === section)
      )
    }
    return map
  }, [])

  function updateField<K extends keyof VendorApplicationFormValues>(
    key: K,
    value: VendorApplicationFormValues[K]
  ) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    for (const field of getEnabledVendorApplicationFields()) {
      if (!field.required) continue
      const raw = values[field.key as keyof VendorApplicationFormValues]
      if (!String(raw || "").trim()) {
        setError(`${field.label} is required.`)
        return
      }
    }

    onSubmit(values)
  }

  function renderField(field: VendorApplicationFieldDef) {
    const id = `vendor-app-${field.key}`
    const value = String(values[field.key as keyof VendorApplicationFormValues] ?? "")

    if (field.type === "select_vendor_type") {
      return (
        <div key={field.key} className="space-y-2">
          <Label htmlFor={id}>
            {field.label}
            {field.required ? " *" : ""}
          </Label>
          <Select
            value={value || undefined}
            onValueChange={(next) => updateField("vendor_type_id", next)}
            disabled={isSubmitting}
          >
            <SelectTrigger id={id}>
              <SelectValue placeholder="Select business type" />
            </SelectTrigger>
            <SelectContent>
              {vendorTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {field.helpText ? (
            <p className="text-xs text-muted-foreground">{field.helpText}</p>
          ) : null}
        </div>
      )
    }

    if (field.type === "textarea") {
      return (
        <div key={field.key} className="space-y-2">
          <Label htmlFor={id}>
            {field.label}
            {field.required ? " *" : ""}
          </Label>
          <Textarea
            id={id}
            value={value}
            rows={field.rows ?? 3}
            placeholder={field.placeholder}
            disabled={isSubmitting}
            onChange={(event) =>
              updateField(field.key as keyof VendorApplicationFormValues, event.target.value)
            }
          />
          {field.helpText ? (
            <p className="text-xs text-muted-foreground">{field.helpText}</p>
          ) : null}
        </div>
      )
    }

    return (
      <div key={field.key} className="space-y-2">
        <Label htmlFor={id}>
          {field.label}
          {field.required ? " *" : ""}
        </Label>
        <Input
          id={id}
          type={field.type === "url" ? "text" : field.type}
          value={value}
          placeholder={field.placeholder}
          disabled={isSubmitting}
          onChange={(event) =>
            updateField(field.key as keyof VendorApplicationFormValues, event.target.value)
          }
        />
        {field.helpText ? (
          <p className="text-xs text-muted-foreground">{field.helpText}</p>
        ) : null}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {SECTION_ORDER.map((section) => {
        const fields = fieldsBySection.get(section) || []
        if (fields.length === 0) return null

        const useTwoCol =
          section === "contact" || section === "social" || section === "business"

        return (
          <section key={section} className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {VENDOR_APPLICATION_SECTION_LABELS[section]}
              </h3>
            </div>
            <div className={useTwoCol ? "grid gap-4 sm:grid-cols-2" : "space-y-4"}>
              {fields.map((field) => {
                const fullWidth =
                  field.type === "textarea" ||
                  field.type === "select_vendor_type" ||
                  field.key === "business_name"
                return (
                  <div key={field.key} className={fullWidth && useTwoCol ? "sm:col-span-2" : undefined}>
                    {renderField(field)}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting || vendorTypes.length === 0}>
          {isSubmitting ? "Submitting…" : "Submit application"}
        </Button>
      </div>
      {vendorTypes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Vendor types are not set up yet. Please contact the organizer.
        </p>
      ) : null}
    </form>
  )
}
