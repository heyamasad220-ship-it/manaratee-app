"use client"

import { EditSectionCard } from "./edit-section-card"

const REGISTRATION_OPTION_ITEMS = [
  {
    id: "full_program",
    label: "Full Program Registration",
    description:
      "Customers register once for the entire program. Use for camps, full-season programs, and fixed courses.",
  },
  {
    id: "session",
    label: "Session-Based Registration",
    description:
      "Customers can select one or more sessions. Use for swimming lessons, workshops, and multi-week programs.",
  },
  {
    id: "single_session",
    label: "Single Session",
    description: "Register for a single session only.",
  },
  {
    id: "drop_in",
    label: "Drop-In",
    description:
      "Drop in for an individual session without a full commitment.",
  },
] as const

function RegistrationCheckbox({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description: string
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5"
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </span>
    </label>
  )
}

export function RegistrationOptionsSection({
  fullProgramRegistrationEnabled,
  sessionRegistrationEnabled,
  onFullProgramChange,
  onSessionChange,
  singleSessionEnabled,
  dropInEnabled,
  onSingleSessionChange,
  onDropInChange,
}: {
  fullProgramRegistrationEnabled: boolean
  sessionRegistrationEnabled: boolean
  onFullProgramChange: (enabled: boolean) => void
  onSessionChange: (enabled: boolean) => void
  singleSessionEnabled: boolean
  dropInEnabled: boolean
  onSingleSessionChange: (enabled: boolean) => void
  onDropInChange: (enabled: boolean) => void
}) {
  const checkboxState = {
    full_program: fullProgramRegistrationEnabled,
    session: sessionRegistrationEnabled,
    single_session: singleSessionEnabled,
    drop_in: dropInEnabled,
  }

  const checkboxHandlers = {
    full_program: onFullProgramChange,
    session: onSessionChange,
    single_session: onSingleSessionChange,
    drop_in: onDropInChange,
  }

  return (
    <EditSectionCard
      title="Registration Options"
      description="Default registration types for this program. Fine-tune each offering on the Offerings tab."
    >
      <div className="space-y-3">
        {REGISTRATION_OPTION_ITEMS.map((item) => (
          <RegistrationCheckbox
            key={item.id}
            checked={checkboxState[item.id]}
            onChange={checkboxHandlers[item.id]}
            label={item.label}
            description={item.description}
          />
        ))}
      </div>
    </EditSectionCard>
  )
}
