"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Program } from "@/lib/programs/program-types"

import { EditSectionCard } from "./edit-section-card"

type FinancialAssistanceDefaults = Pick<
  Program,
  | "financial_assistance_enabled"
  | "financial_assistance_open"
  | "financial_assistance_close_date"
  | "financial_assistance_instructions"
>

export function FinancialAssistanceSection({
  program = null,
  disabled = false,
}: {
  program?: FinancialAssistanceDefaults | null
  disabled?: boolean
}) {
  const defaults: FinancialAssistanceDefaults = {
    financial_assistance_enabled: false,
    financial_assistance_open: false,
    financial_assistance_close_date: null,
    financial_assistance_instructions: null,
    ...program,
  }
  return (
    <EditSectionCard
      title="Financial Assistance"
      description="Control whether customers can apply for financial assistance during registration."
    >
      <div className="space-y-4">
        <label className="flex items-start gap-3 rounded-md border p-3">
          <input
            type="checkbox"
            name="financial_assistance_enabled"
            defaultChecked={defaults.financial_assistance_enabled || false}
            disabled={disabled}
            className="mt-0.5"
          />
          <div>
            <p className="text-sm font-medium">Enable financial assistance</p>
            <p className="text-xs text-muted-foreground">
              Customers can apply for scholarships or payment assistance for this
              program.
            </p>
          </div>
        </label>

        <label className="flex items-start gap-3 rounded-md border p-3">
          <input
            type="checkbox"
            name="financial_assistance_open"
            defaultChecked={defaults.financial_assistance_open || false}
            disabled={disabled}
            className="mt-0.5"
          />
          <div>
            <p className="text-sm font-medium">Open applications</p>
            <p className="text-xs text-muted-foreground">
              Turn this off when applications are closed.
            </p>
          </div>
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="financial_assistance_close_date">
              Application Close Date
            </Label>
            <Input
              id="financial_assistance_close_date"
              name="financial_assistance_close_date"
              type="date"
              className="h-9"
              defaultValue={defaults.financial_assistance_close_date || ""}
              disabled={disabled}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="financial_assistance_instructions">
            Customer Instructions
          </Label>
          <Textarea
            id="financial_assistance_instructions"
            name="financial_assistance_instructions"
            rows={4}
            defaultValue={defaults.financial_assistance_instructions || ""}
            placeholder="Explain requirements, deadlines, proof of income expectations, etc."
            disabled={disabled}
          />
        </div>
      </div>
    </EditSectionCard>
  )
}
