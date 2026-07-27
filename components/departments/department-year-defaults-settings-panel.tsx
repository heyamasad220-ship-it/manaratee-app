"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

import { ProgramDefaultsSettingsPanel } from "@/components/programs/program-defaults-settings-panel"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { departmentGroupWorkspaceHref } from "@/lib/donations/donation-group-path"
import { getSelectedOrganizationIdClient } from "@/lib/organizations/get-selected-organization-id-client"
import { YEAR_SEASON_LABEL, YEAR_SEASON_LABEL_PLURAL } from "@/lib/programs/program-display-labels"
import { getProgramStatusLabel, type ProgramStatus } from "@/lib/programs/program-status"
import type { Program } from "@/lib/programs/program-types"
import { createClient } from "@/lib/supabase/client"

type YearOption = {
  id: string
  name: string
  status: string
}

export function DepartmentYearDefaultsSettingsPanel({
  departmentId,
}: {
  departmentId: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const yearFromUrl = searchParams.get("year") || ""

  const [loading, setLoading] = React.useState(true)
  const [loadingProgram, setLoadingProgram] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [years, setYears] = React.useState<YearOption[]>([])
  const [selectedYearId, setSelectedYearId] = React.useState("")
  const [program, setProgram] = React.useState<Program | null>(null)

  React.useEffect(() => {
    async function loadYears() {
      setLoading(true)
      setError(null)

      try {
        const orgId = await getSelectedOrganizationIdClient()
        if (!orgId) {
          setError("No organization selected.")
          setYears([])
          return
        }

        const { data, error: yearsError } = await supabase
          .from("programs")
          .select("id, name, status")
          .eq("organization_id", orgId)
          .eq("department_id", departmentId)
          .order("start_date", { ascending: false, nullsFirst: false })
          .order("name", { ascending: true })

        if (yearsError) throw yearsError

        const nextYears = (data ?? []) as YearOption[]
        setYears(nextYears)

        const preferred =
          (yearFromUrl && nextYears.some((y) => y.id === yearFromUrl)
            ? yearFromUrl
            : null) ||
          nextYears.find((y) => y.status !== "archived")?.id ||
          nextYears[0]?.id ||
          ""

        setSelectedYearId(preferred)
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : `Could not load ${YEAR_SEASON_LABEL_PLURAL.toLowerCase()}.`
        )
        setYears([])
      } finally {
        setLoading(false)
      }
    }

    void loadYears()
    // Prefill from URL on mount / department change only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId, supabase])

  React.useEffect(() => {
    if (!yearFromUrl || yearFromUrl === selectedYearId) return
    if (years.some((year) => year.id === yearFromUrl)) {
      setSelectedYearId(yearFromUrl)
    }
  }, [yearFromUrl, years, selectedYearId])

  React.useEffect(() => {
    if (!selectedYearId) {
      setProgram(null)
      return
    }

    let cancelled = false
    async function loadProgram() {
      setLoadingProgram(true)
      setError(null)
      try {
        const orgId = await getSelectedOrganizationIdClient()
        if (!orgId) {
          setError("No organization selected.")
          setProgram(null)
          return
        }

        const { data, error: programError } = await supabase
          .from("programs")
          .select("*")
          .eq("organization_id", orgId)
          .eq("department_id", departmentId)
          .eq("id", selectedYearId)
          .maybeSingle()

        if (programError) throw programError
        if (cancelled) return
        setProgram((data as Program | null) ?? null)
      } catch (loadError) {
        if (cancelled) return
        setError(
          loadError instanceof Error
            ? loadError.message
            : `Could not load ${YEAR_SEASON_LABEL.toLowerCase()} defaults.`
        )
        setProgram(null)
      } finally {
        if (!cancelled) setLoadingProgram(false)
      }
    }

    void loadProgram()
    return () => {
      cancelled = true
    }
  }, [selectedYearId, departmentId, supabase])

  function handleYearChange(nextYearId: string) {
    setSelectedYearId(nextYearId)
    router.replace(
      departmentGroupWorkspaceHref(departmentId, {
        tab: "settings",
        settingsSection: "year-defaults",
        yearProgramId: nextYearId || undefined,
      }),
      { scroll: false }
    )
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading {YEAR_SEASON_LABEL_PLURAL.toLowerCase()}…
      </div>
    )
  }

  if (error && years.length === 0) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </div>
    )
  }

  if (years.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{YEAR_SEASON_LABEL} defaults</CardTitle>
          <CardDescription>
            Create a {YEAR_SEASON_LABEL.toLowerCase()} on Overview first, then configure
            enrollment defaults here.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{YEAR_SEASON_LABEL} defaults</CardTitle>
          <CardDescription>
            Enrollment window, audience, and eligibility defaults for a selected{" "}
            {YEAR_SEASON_LABEL.toLowerCase()}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md space-y-2">
            <Label htmlFor="dept-year-defaults-year">{YEAR_SEASON_LABEL}</Label>
            <Select value={selectedYearId} onValueChange={handleYearChange}>
              <SelectTrigger id="dept-year-defaults-year">
                <SelectValue
                  placeholder={`Select a ${YEAR_SEASON_LABEL.toLowerCase()}`}
                />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year.id} value={year.id}>
                    {year.name}
                    {year.status !== "active"
                      ? ` (${getProgramStatusLabel(year.status as ProgramStatus)})`
                      : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loadingProgram ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading defaults…
        </div>
      ) : program ? (
        <ProgramDefaultsSettingsPanel key={program.id} program={program} />
      ) : null}
    </div>
  )
}
