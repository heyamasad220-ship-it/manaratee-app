"use client"

import { CheckCircle2 } from "lucide-react"

import { cn } from "@/lib/utils"
import type { ProgramRegistrationOption } from "@/lib/programs/program-registration-option-types"
import { REGISTRATION_OPTION_LABELS } from "@/lib/programs/program-registration-option-types"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const OPTION_DESCRIPTIONS: Record<string, string> = {
  full_program:
    "Register for the complete program. Access is granted to all sessions in this offering.",
  selected_sessions: "Choose one or more sessions or weeks.",
  single_session: "Register for a single session only.",
  drop_in: "Drop in for an individual session without a full commitment.",
}

export function ProgramRegistrationOptionsEditor({
  options,
  singleSessionEnabled,
  dropInEnabled,
  onSingleSessionChange,
  onDropInChange,
}: {
  options: ProgramRegistrationOption[]
  singleSessionEnabled: boolean
  dropInEnabled: boolean
  onSingleSessionChange: (enabled: boolean) => void
  onDropInChange: (enabled: boolean) => void
}) {
  const coreOptions = options.filter((option) =>
    ["full_program", "selected_sessions"].includes(option.option_type)
  )

  return (
    <div className="space-y-4">
      {coreOptions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Core options</p>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Registration Option</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coreOptions.map((option) => (
                  <TableRow key={option.id}>
                    <TableCell>
                      <p className="font-medium">
                        {option.name ||
                          REGISTRATION_OPTION_LABELS[option.option_type]}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {OPTION_DESCRIPTIONS[option.option_type]}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "text-xs font-medium",
                          option.is_active
                            ? "text-emerald-700"
                            : "text-muted-foreground"
                        )}
                      >
                        {option.is_active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
          <input
            type="checkbox"
            checked={singleSessionEnabled}
            onChange={(event) => onSingleSessionChange(event.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-medium">Single Session</span>
            <span className="text-xs text-muted-foreground">
              {OPTION_DESCRIPTIONS.single_session}
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
          <input
            type="checkbox"
            checked={dropInEnabled}
            onChange={(event) => onDropInChange(event.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-medium">Drop-In</span>
            <span className="text-xs text-muted-foreground">
              {OPTION_DESCRIPTIONS.drop_in}
            </span>
          </span>
        </label>
      </div>
    </div>
  )
}

export function CustomerRegistrationOptionPicker({
  options,
  name = "registration_option_id",
}: {
  options: ProgramRegistrationOption[]
  name?: string
}) {
  if (options.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
        No registration options are available for this program yet.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">
          Registration Option <span className="text-red-500">*</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Choose how you want to register before selecting a participant and
          sessions.
        </p>
      </div>

      <div className="grid gap-3">
        {options.map((option, index) => (
          <label
            key={option.id}
            className="flex cursor-pointer items-start gap-3 rounded-lg border bg-background px-4 py-3 text-sm hover:bg-muted"
          >
            <input
              type="radio"
              name={name}
              value={option.id}
              required
              defaultChecked={index === 0}
              data-option-type={option.option_type}
              className="mt-1 registration-option-input"
            />
            <span>
              <span className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                {option.name || REGISTRATION_OPTION_LABELS[option.option_type]}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {OPTION_DESCRIPTIONS[option.option_type]}
              </span>
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
