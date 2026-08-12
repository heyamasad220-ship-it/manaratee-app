"use client"

import * as React from "react"

import type { ProgramGender } from "@/components/programs/edit/types"
import {
  AGE_OPTIONS,
  ageSelectValue,
} from "@/components/programs/edit/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { PROGRAM_LABEL_PLURAL } from "@/lib/programs/program-display-labels"
import type { OfferingDeliveryFormat } from "@/lib/programs/program-offering-attributes"
import {
  OFFERING_DELIVERY_FORMAT_OPTIONS,
  PROGRAM_OFFERING_STATUS_LABELS,
  type ProgramOfferingStatus,
} from "@/lib/programs/program-offering-types"
import {
  PROGRAM_KIND_LABELS,
  type ProgramKind,
} from "@/lib/programs/program-kind"
import { cn } from "@/lib/utils"

export type OfferingBasicsFormValues = {
  kind: ProgramKind
  name: string
  deliveryFormat: OfferingDeliveryFormat
  status?: ProgramOfferingStatus
  startDate: string
  endDate: string
  enrollmentOpenDate: string
  enrollmentCloseDate: string
  primaryInstructorId: string
  gender: ProgramGender
  minAge: number | null
  maxAge: number | null
  capacity: string
  feeAmount?: string
  openEnrollment?: boolean
}

export type OfferingBasicsFormProps = {
  mode: "create" | "edit"
  values: OfferingBasicsFormValues
  onChange: (patch: Partial<OfferingBasicsFormValues>) => void
  disabled?: boolean
  /** When false, hides dates / instructor / eligibility (create: academic under seasonal parent). */
  showDetailFields?: boolean
  departmentId?: string | null
  departmentName?: string | null
  staffOptions?: Array<{
    id: string
    full_name: string | null
    email: string | null
  }>
  /** Edit-only: include closed if the offering is already closed. */
  statusOptions?: ProgramOfferingStatus[]
  kindRadioName?: string
}

export function OfferingBasicsForm({
  mode,
  values,
  onChange,
  disabled = false,
  showDetailFields = true,
  departmentId = null,
  departmentName = null,
  staffOptions = [],
  statusOptions = ["draft", "active"],
  kindRadioName = "offering-form-kind",
}: OfferingBasicsFormProps) {
  const isSeasonal = values.kind === "seasonal"

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Type</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(PROGRAM_KIND_LABELS) as ProgramKind[]).map((kind) => (
            <label
              key={kind}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm font-medium transition-colors",
                values.kind === kind
                  ? "border-sky-500 bg-sky-50/80"
                  : "hover:bg-muted/40",
                disabled && "cursor-not-allowed opacity-60"
              )}
            >
              <input
                type="radio"
                name={kindRadioName}
                className="accent-sky-600"
                checked={values.kind === kind}
                onChange={() =>
                  onChange({
                    kind,
                    ...(mode === "create"
                      ? { openEnrollment: kind === "seasonal" }
                      : {}),
                  })
                }
                disabled={disabled}
              />
              {PROGRAM_KIND_LABELS[kind]}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${mode}-offering-name`}>Name</Label>
        <Input
          id={`${mode}-offering-name`}
          value={values.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder={
            isSeasonal ? "Camp or season name" : "Class or track name"
          }
          disabled={disabled}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${mode}-offering-delivery`}>Delivery</Label>
        <select
          id={`${mode}-offering-delivery`}
          value={values.deliveryFormat}
          onChange={(event) =>
            onChange({
              deliveryFormat: event.target.value as OfferingDeliveryFormat,
            })
          }
          disabled={disabled}
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
        >
          {OFFERING_DELIVERY_FORMAT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {!isSeasonal && mode === "create" ? (
          <p className="text-xs text-muted-foreground">
            Create separate {PROGRAM_LABEL_PLURAL.toLowerCase()} for on-site and
            online when instructors or capacity differ.
          </p>
        ) : null}
      </div>

      {mode === "edit" ? (
        <div className="space-y-2">
          <Label htmlFor={`${mode}-offering-status`}>Status</Label>
          <select
            id={`${mode}-offering-status`}
            value={values.status ?? "draft"}
            onChange={(event) =>
              onChange({
                status: event.target.value as ProgramOfferingStatus,
              })
            }
            disabled={disabled}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {PROGRAM_OFFERING_STATUS_LABELS[option]}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {showDetailFields ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${mode}-offering-start`}>Start date</Label>
              <Input
                id={`${mode}-offering-start`}
                type="date"
                value={values.startDate}
                onChange={(event) => onChange({ startDate: event.target.value })}
                disabled={disabled}
                className="bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${mode}-offering-end`}>End date</Label>
              <Input
                id={`${mode}-offering-end`}
                type="date"
                value={values.endDate}
                onChange={(event) => onChange({ endDate: event.target.value })}
                disabled={disabled}
                className="bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${mode}-offering-enroll-open`}>
                Enrollment opens
              </Label>
              <Input
                id={`${mode}-offering-enroll-open`}
                type="date"
                value={values.enrollmentOpenDate}
                onChange={(event) =>
                  onChange({ enrollmentOpenDate: event.target.value })
                }
                disabled={disabled}
                className="bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${mode}-offering-enroll-close`}>
                Enrollment closes
              </Label>
              <Input
                id={`${mode}-offering-enroll-close`}
                type="date"
                value={values.enrollmentCloseDate}
                onChange={(event) =>
                  onChange({ enrollmentCloseDate: event.target.value })
                }
                disabled={disabled}
                className="bg-background"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${mode}-offering-instructor`}>
              Primary instructor
            </Label>
            <select
              id={`${mode}-offering-instructor`}
              value={values.primaryInstructorId}
              onChange={(event) =>
                onChange({ primaryInstructorId: event.target.value })
              }
              disabled={disabled}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">
                {departmentId && staffOptions.length === 0
                  ? "No employees in this department"
                  : "Select instructor"}
              </option>
              {staffOptions.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.full_name || staff.email || "Unnamed contact"}
                </option>
              ))}
            </select>
            {departmentId ? (
              <p className="text-xs text-muted-foreground">
                Employees assigned to this department
                {departmentName ? ` (${departmentName})` : ""}.
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor={`${mode}-offering-gender`}>Gender</Label>
              <select
                id={`${mode}-offering-gender`}
                value={values.gender}
                onChange={(event) =>
                  onChange({ gender: event.target.value as ProgramGender })
                }
                disabled={disabled}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="All">Both</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${mode}-offering-min-age`}>Minimum age</Label>
              <select
                id={`${mode}-offering-min-age`}
                value={ageSelectValue(values.minAge)}
                onChange={(event) =>
                  onChange({
                    minAge: event.target.value
                      ? Number(event.target.value)
                      : null,
                  })
                }
                disabled={disabled}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">No minimum</option>
                {AGE_OPTIONS.map((age) => (
                  <option key={age} value={age}>
                    {age}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${mode}-offering-max-age`}>Maximum age</Label>
              <select
                id={`${mode}-offering-max-age`}
                value={ageSelectValue(values.maxAge)}
                onChange={(event) =>
                  onChange({
                    maxAge: event.target.value
                      ? Number(event.target.value)
                      : null,
                  })
                }
                disabled={disabled}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">No maximum</option>
                {AGE_OPTIONS.map((age) => (
                  <option key={age} value={age}>
                    {age}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {mode === "create" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${mode}-offering-capacity`}>Capacity</Label>
                <Input
                  id={`${mode}-offering-capacity`}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="Unlimited if blank"
                  value={values.capacity}
                  onChange={(event) =>
                    onChange({ capacity: event.target.value })
                  }
                  disabled={disabled}
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${mode}-offering-fee`}>Fee</Label>
                <Input
                  id={`${mode}-offering-fee`}
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  placeholder="Tuition"
                  value={values.feeAmount ?? ""}
                  onChange={(event) =>
                    onChange({ feeAmount: event.target.value })
                  }
                  disabled={disabled}
                  className="bg-background"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${mode}-offering-capacity`}>Capacity</Label>
                <Input
                  id={`${mode}-offering-capacity`}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="Unlimited if blank"
                  value={values.capacity}
                  onChange={(event) =>
                    onChange({ capacity: event.target.value })
                  }
                  disabled={disabled}
                  className="bg-background"
                />
              </div>
            </div>
          )}

          {mode === "create" ? (
            <label className="flex items-start justify-between gap-3 rounded-md border p-3 text-sm">
              <span className="space-y-0.5">
                <span className="block font-medium">
                  Automatically register and pay
                </span>
                <span className="block text-xs text-muted-foreground">
                  No Apply / Approve step — customers register and pay
                  immediately.
                </span>
              </span>
              <Switch
                checked={values.openEnrollment === true}
                onCheckedChange={(checked) =>
                  onChange({ openEnrollment: checked })
                }
                disabled={disabled}
              />
            </label>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
