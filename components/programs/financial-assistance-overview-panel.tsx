"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { FinancialAssistanceSection } from "@/components/programs/edit/financial-assistance-section"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getProgramsFinancialAssistanceSettings,
  setProgramFinancialAssistanceEnabled,
  updateProgramFinancialAssistanceSettings,
  type ProgramFinancialAssistanceSettings,
} from "@/lib/programs/program-financial-assistance-actions"
import { getProgramStatusLabel } from "@/lib/programs/program-status"

function statusBadgeVariant(status: string) {
  switch (status) {
    case "active":
      return "default" as const
    case "draft":
      return "secondary" as const
    default:
      return "outline" as const
  }
}

export function FinancialAssistanceOverviewPanel({
  initialPrograms,
  canManage,
}: {
  initialPrograms: ProgramFinancialAssistanceSettings[]
  canManage: boolean
}) {
  const [programs, setPrograms] =
    React.useState<ProgramFinancialAssistanceSettings[]>(initialPrograms)
  const [selectedProgramId, setSelectedProgramId] = React.useState<string>(
    initialPrograms[0]?.id ?? ""
  )
  const [isSaving, setIsSaving] = React.useState(false)
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const [toggleProgramId, setToggleProgramId] = React.useState<string | null>(
    null
  )
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)
  const formRef = React.useRef<HTMLFormElement>(null)

  const selectedProgram = programs.find(
    (program) => program.id === selectedProgramId
  )

  React.useEffect(() => {
    if (!selectedProgramId && programs.length > 0) {
      setSelectedProgramId(programs[0].id)
    }
  }, [programs, selectedProgramId])

  async function refreshPrograms() {
    setIsRefreshing(true)
    try {
      const nextPrograms = await getProgramsFinancialAssistanceSettings()
      setPrograms(nextPrograms)
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Failed to refresh programs."
      )
    } finally {
      setIsRefreshing(false)
    }
  }

  async function handleToggleEnabled(
    program: ProgramFinancialAssistanceSettings,
    enabled: boolean
  ) {
    if (!canManage) {
      return
    }

    setError(null)
    setSuccess(null)
    setToggleProgramId(program.id)

    const result = await setProgramFinancialAssistanceEnabled(program.id, enabled)

    setToggleProgramId(null)

    if (!result.success) {
      setError(result.error)
      return
    }

    setPrograms((current) =>
      current.map((item) =>
        item.id === program.id
          ? {
              ...item,
              financial_assistance_enabled: enabled,
              financial_assistance_open: enabled
                ? item.financial_assistance_open
                : false,
            }
          : item
      )
    )
    setSuccess(
      enabled
        ? `Financial assistance enabled for ${program.name}.`
        : `Financial assistance disabled for ${program.name}.`
    )
  }

  async function handleSaveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canManage || !selectedProgram) {
      return
    }

    const formData = new FormData(event.currentTarget)

    setIsSaving(true)
    setError(null)
    setSuccess(null)

    const result = await updateProgramFinancialAssistanceSettings({
      programId: selectedProgram.id,
      financial_assistance_enabled:
        formData.get("financial_assistance_enabled") === "on",
      financial_assistance_open:
        formData.get("financial_assistance_open") === "on",
      financial_assistance_close_date:
        String(formData.get("financial_assistance_close_date") || "") || null,
      financial_assistance_instructions:
        String(formData.get("financial_assistance_instructions") || "") || null,
    })

    setIsSaving(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    const updatedSettings = {
      financial_assistance_enabled:
        formData.get("financial_assistance_enabled") === "on",
      financial_assistance_open:
        formData.get("financial_assistance_open") === "on",
      financial_assistance_close_date:
        String(formData.get("financial_assistance_close_date") || "") || null,
      financial_assistance_instructions:
        String(formData.get("financial_assistance_instructions") || "") || null,
    }

    setPrograms((current) =>
      current.map((item) =>
        item.id === selectedProgram.id ? { ...item, ...updatedSettings } : item
      )
    )
    setSuccess(`Financial assistance settings saved for ${selectedProgram.name}.`)
  }

  if (programs.length === 0) {
    return (
      <div className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
        No programs found. Create a program first, then configure financial
        assistance here.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Program Settings</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Enable or disable financial assistance for active and draft
            programs. Select a program below to edit application
            details.
          </p>
        </div>

        <div className="overflow-x-auto p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Program</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead>Applications</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {programs.map((program) => {
                const isSelected = program.id === selectedProgramId
                const isToggling = toggleProgramId === program.id

                return (
                  <TableRow
                    key={program.id}
                    data-state={isSelected ? "selected" : undefined}
                    className="cursor-pointer"
                    onClick={() => setSelectedProgramId(program.id)}
                  >
                    <TableCell className="font-medium">{program.name}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(program.status)}>
                        {getProgramStatusLabel(program.status)}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={program.financial_assistance_enabled}
                          disabled={!canManage || isToggling}
                          onCheckedChange={(checked) =>
                            void handleToggleEnabled(program, checked)
                          }
                          aria-label={`Enable financial assistance for ${program.name}`}
                        />
                        {isToggling ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {program.financial_assistance_enabled &&
                      program.financial_assistance_open ? (
                        <Badge variant="default">Open</Badge>
                      ) : program.financial_assistance_enabled ? (
                        <Badge variant="secondary">Closed</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {selectedProgram ? (
        <form
          key={selectedProgram.id}
          ref={formRef}
          onSubmit={handleSaveSettings}
          className="space-y-4"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="financial-assistance-program">Configure program</Label>
              <Select
                value={selectedProgramId}
                onValueChange={setSelectedProgramId}
              >
                <SelectTrigger id="financial-assistance-program" className="w-[min(100%,320px)]">
                  <SelectValue placeholder="Select a program" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((program) => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {canManage ? (
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save settings"
                )}
              </Button>
            ) : null}
          </div>

          <FinancialAssistanceSection
            program={selectedProgram}
            disabled={!canManage}
          />

          {!canManage ? (
            <p className="text-xs text-muted-foreground">
              You can view settings but need program management permission to
              make changes.
            </p>
          ) : null}
        </form>
      ) : null}

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {success}
        </p>
      ) : null}

      {canManage ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isRefreshing}
            onClick={() => void refreshPrograms()}
          >
            {isRefreshing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              "Refresh programs"
            )}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
