"use client"

import type { ReactNode } from "react"
import * as React from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Department } from "@/lib/departments/department-types"
import { parseProgramAgeBounds } from "@/lib/programs/program-eligibility-display"
import { cn } from "@/lib/utils"

import { ProgramBrandingColors } from "./program-branding-colors"
import type { ProgramGender, VisibilityType } from "./types"
import { AGE_OPTIONS, ageSelectValue } from "./utils"

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
  gender?: string | null
  min_age?: number | null
  max_age?: number | null
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
  const ageBounds = React.useMemo(
    () =>
      parseProgramAgeBounds({
        min_age: program?.min_age ?? null,
        max_age: program?.max_age ?? null,
      }),
    [program?.min_age, program?.max_age]
  )
  const [minAge, setMinAge] = React.useState<number | null>(ageBounds.minAge)
  const [maxAge, setMaxAge] = React.useState<number | null>(ageBounds.maxAge)
  const [gender, setGender] = React.useState<ProgramGender>(
    (program?.gender as ProgramGender) || "All"
  )

  React.useEffect(() => {
    setFlyerUrl(program?.flyer_url ?? "")
  }, [program?.flyer_url])

  React.useEffect(() => {
    const next = parseProgramAgeBounds({
      min_age: program?.min_age ?? null,
      max_age: program?.max_age ?? null,
    })
    setMinAge(next.minAge)
    setMaxAge(next.maxAge)
    setGender((program?.gender as ProgramGender) || "All")
  }, [program?.min_age, program?.max_age, program?.gender])

  return (
    <div className="grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-2 md:items-start">
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

        <BasicsSubsection
          title="Schedule"
          description="Program dates apply to all offerings unless an offering sets its own dates."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="start_date">Start date</Label>
              <Input
                id="start_date"
                name="start_date"
                type="date"
                defaultValue={program?.start_date || ""}
                className="bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end_date">End date</Label>
              <Input
                id="end_date"
                name="end_date"
                type="date"
                defaultValue={program?.end_date || ""}
                className="bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="enrollment_open_date">Enrollment opens</Label>
              <Input
                id="enrollment_open_date"
                name="enrollment_open_date"
                type="date"
                defaultValue={program?.enrollment_open_date || ""}
                className="bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="enrollment_close_date">Enrollment closes</Label>
              <Input
                id="enrollment_close_date"
                name="enrollment_close_date"
                type="date"
                defaultValue={program?.enrollment_close_date || ""}
                className="bg-background"
              />
            </div>
          </div>
        </BasicsSubsection>

        <BasicsSubsection
          title="Eligibility"
          description="Gender and age apply to the whole program. Offerings inherit these for years like QIL; summer camps can still use capacity groups per offering when needed."
        >
          <input type="hidden" name="min_age" value={ageSelectValue(minAge)} />
          <input type="hidden" name="max_age" value={ageSelectValue(maxAge)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="gender">Gender</Label>
              <select
                id="gender"
                name="gender"
                value={gender}
                onChange={(event) =>
                  setGender(event.target.value as ProgramGender)
                }
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="All">All genders</option>
                <option value="Male">Male only</option>
                <option value="Female">Female only</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="min_age_select">Minimum age</Label>
              <select
                id="min_age_select"
                value={ageSelectValue(minAge)}
                onChange={(event) =>
                  setMinAge(event.target.value ? Number(event.target.value) : null)
                }
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
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="max_age_select">Maximum age</Label>
              <select
                id="max_age_select"
                value={ageSelectValue(maxAge)}
                onChange={(event) =>
                  setMaxAge(event.target.value ? Number(event.target.value) : null)
                }
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
        </BasicsSubsection>
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
