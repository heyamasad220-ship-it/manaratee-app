"use client"

import type { ReactNode } from "react"
import * as React from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Department } from "@/lib/departments/department-types"
import { cn } from "@/lib/utils"

import { ProgramBrandingColors } from "./program-branding-colors"
import type { VisibilityType } from "./types"

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "archived", label: "Archived" },
] as const

type ProgramBasicsDefaults = {
  name?: string
  subtitle?: string | null
  description?: string | null
  department_id?: string | null
  start_date?: string | null
  end_date?: string | null
  enrollment_open_date?: string | null
  enrollment_close_date?: string | null
  flyer_url?: string | null
  background_color?: string | null
}

function BasicsSubsection({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("overflow-hidden rounded-lg border bg-muted/40", className)}>
      <div className="border-b bg-muted/60 px-3 py-2.5">
        <h3 className="text-sm font-semibold leading-none">{title}</h3>
        {description ? (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="space-y-3 p-3">{children}</div>
    </section>
  )
}

export function ProgramBasicsSection({
  program = null,
  programId,
  departments,
  status,
  onStatusChange,
  initialVisibility = "public",
  programStatusFallback = "draft",
  allowedStatuses,
}: {
  program?: ProgramBasicsDefaults | null
  programId?: string
  departments: Department[]
  status?: string
  onStatusChange?: (status: string) => void
  initialVisibility?: VisibilityType
  programStatusFallback?: string
  allowedStatuses?: Array<(typeof STATUS_OPTIONS)[number]["value"]>
}) {
  const statusOptions = allowedStatuses
    ? STATUS_OPTIONS.filter((option) => allowedStatuses.includes(option.value))
    : STATUS_OPTIONS

  const [flyerUrl, setFlyerUrl] = React.useState(program?.flyer_url ?? "")

  React.useEffect(() => {
    setFlyerUrl(program?.flyer_url ?? "")
  }, [program?.flyer_url])

  return (
    <div className="mt-6 grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-2 md:items-start">
      <div className="min-w-0 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="name">Program Name *</Label>
          <Input
            id="name"
            name="name"
            required
            defaultValue={program?.name ?? ""}
          />
        </div>

        <div className="overflow-hidden rounded-lg border bg-muted/40">
          <div className="space-y-3 p-3">
            <div className="space-y-1.5">
              <Label htmlFor="subtitle">Subtitle</Label>
              <Input
                id="subtitle"
                name="subtitle"
                defaultValue={program?.subtitle || ""}
                placeholder="Short tagline shown under the program name"
                className="bg-background"
              />
              <p className="text-xs text-muted-foreground">
                A brief line customers see below the program title.
              </p>
            </div>

            <ProgramBrandingColors
              flyerUrl={flyerUrl}
              onFlyerUrlChange={setFlyerUrl}
              programId={programId}
              initialBackgroundColor={program?.background_color}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            rows={5}
            defaultValue={program?.description || ""}
            placeholder="Describe what participants will experience..."
          />
        </div>
      </div>

      <div className="min-w-0">
        <BasicsSubsection title="Publishing">
          <div className="space-y-1.5">
            <Label htmlFor="department_id">Department</Label>
            <select
              id="department_id"
              name="department_id"
              defaultValue={program?.department_id || ""}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">No department</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="visibility">Visibility</Label>
            <select
              id="visibility"
              name="visibility"
              defaultValue={initialVisibility}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="public">Public</option>
              <option value="members_only">Members Only</option>
              <option value="private">Private</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              name="status"
              value={status ?? programStatusFallback}
              onChange={(event) => onStatusChange?.(event.target.value)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Programs stay in Draft until you change status to Active.
            </p>
          </div>
        </BasicsSubsection>
      </div>
    </div>
  )
}
