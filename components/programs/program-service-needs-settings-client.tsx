"use client"

import { useEffect, useState, useTransition } from "react"
import { Loader2 } from "lucide-react"

import { ProgramServiceRequirementsPanel } from "@/components/programs/edit/program-service-requirements-panel"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DEFAULT_EVENT_SERVICE_REQUIREMENTS_FORM } from "@/lib/events/event-service-requirements"
import type { EventServiceRequirementsFormState } from "@/lib/events/event-service-requirements"
import { loadProgramServiceRequirementsForm } from "@/lib/service-participations/service-participation-actions"
import type { VendorHubVendorType } from "@/lib/vendor-hub/vendor-type-types"

type ProgramOption = {
  id: string
  name: string
}

type ProgramServiceNeedsSettingsClientProps = {
  programs: ProgramOption[]
  vendorTypes: VendorHubVendorType[]
  canManageVendorTypes: boolean
  initialProgramId?: string | null
}

export function ProgramServiceNeedsSettingsClient({
  programs,
  vendorTypes,
  canManageVendorTypes,
  initialProgramId = null,
}: ProgramServiceNeedsSettingsClientProps) {
  const [programId, setProgramId] = useState(
    initialProgramId && programs.some((program) => program.id === initialProgramId)
      ? initialProgramId
      : programs[0]?.id ?? ""
  )
  const [form, setForm] = useState<EventServiceRequirementsFormState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!programId) {
      setForm(null)
      return
    }

    setError(null)
    setForm(null)

    startTransition(async () => {
      try {
        const nextForm = await loadProgramServiceRequirementsForm(programId)
        setForm(nextForm ?? DEFAULT_EVENT_SERVICE_REQUIREMENTS_FORM)
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load service needs for this program."
        )
        setForm(DEFAULT_EVENT_SERVICE_REQUIREMENTS_FORM)
      }
    })
  }, [programId])

  if (programs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Create a program in the catalog first, then configure its service needs here.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div className="max-w-md space-y-2">
        <Label htmlFor="service-needs-program">Program</Label>
        <Select value={programId} onValueChange={setProgramId}>
          <SelectTrigger id="service-needs-program">
            <SelectValue placeholder="Select a program" />
          </SelectTrigger>
          <SelectContent>
            {programs.map((program) => (
              <SelectItem key={program.id} value={program.id}>
                {program.name || "Untitled program"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Temporary: service needs still save on the selected program. Org-wide defaults can
          come later.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {isPending || !form ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading service needs...
        </div>
      ) : (
        <ProgramServiceRequirementsPanel
          key={programId}
          programId={programId}
          initialForm={form}
          vendorTypes={vendorTypes}
          canManageVendorTypes={canManageVendorTypes}
        />
      )}
    </div>
  )
}
