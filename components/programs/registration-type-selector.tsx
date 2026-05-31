"use client"

import { CheckCircle2, Layers } from "lucide-react"

import { cn } from "@/lib/utils"

function RegistrationOption({
  selected,
  onToggle,
  title,
  description,
}: {
  selected: boolean
  onToggle: () => void
  title: string
  description: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "rounded-lg border p-4 text-left transition hover:bg-muted",
        selected ? "border-primary bg-primary/5" : "bg-background"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 rounded-full border p-1",
            selected ? "border-primary text-primary" : "text-transparent"
          )}
        >
          <CheckCircle2 className="h-4 w-4" />
        </div>

        <div>
          <p className="font-medium">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </button>
  )
}

export function RegistrationTypeSelector({
  fullProgramEnabled,
  sessionRegistrationEnabled,
  onFullProgramChange,
  onSessionChange,
}: {
  fullProgramEnabled: boolean
  sessionRegistrationEnabled: boolean
  onFullProgramChange: (enabled: boolean) => void
  onSessionChange: (enabled: boolean) => void
}) {
  function toggleFullProgram() {
    if (fullProgramEnabled && !sessionRegistrationEnabled) {
      return
    }

    onFullProgramChange(!fullProgramEnabled)
  }

  function toggleSession() {
    if (sessionRegistrationEnabled && !fullProgramEnabled) {
      return
    }

    onSessionChange(!sessionRegistrationEnabled)
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <RegistrationOption
          selected={fullProgramEnabled}
          onToggle={toggleFullProgram}
          title="Full Program Registration"
          description="Customers register once for the entire program dates. Use this for camps, full-season programs, and fixed courses."
        />

        <RegistrationOption
          selected={sessionRegistrationEnabled}
          onToggle={toggleSession}
          title="Session-Based Registration"
          description="Customers can select one or more sessions. Use this for swimming lessons, workshops, and programs with separate weeks or sections."
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Select one or both. At least one registration type must stay enabled.
      </p>

      {sessionRegistrationEnabled ? (
        <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          <div className="flex gap-3">
            <Layers className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              After saving, manage session dates, prices, and capacity from the
              sessions section connected to this program.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function getInitialFullProgramRegistrationEnabled(program: {
  full_program_registration_enabled?: boolean
  session_registration_enabled?: boolean
}) {
  if (program.full_program_registration_enabled !== undefined) {
    return program.full_program_registration_enabled
  }

  return !program.session_registration_enabled
}
