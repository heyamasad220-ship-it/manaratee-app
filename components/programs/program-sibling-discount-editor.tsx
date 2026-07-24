"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { DiscountRuleInput } from "@/lib/programs/program-fee-plan-actions"
import { saveOfferingSiblingDiscountRules } from "@/lib/programs/offering-workspace-actions"
import type { ProgramOfferingDiscountRule } from "@/lib/programs/program-fee-plan-types"

function buildSiblingDiscountRules(
  rules: ProgramOfferingDiscountRule[]
): DiscountRuleInput[] {
  return rules
    .filter((rule) => rule.rule_type === "sibling")
    .map((rule) => ({
      id: rule.id,
      rule_type: rule.rule_type,
      label: rule.label,
      discount_type: rule.discount_type,
      amount: Number(rule.amount || 0),
      fee_plan_id: rule.fee_plan_id,
      is_active: rule.is_active,
      priority_rank: rule.priority_rank,
      exclude_component_types: Array.isArray(rule.conditions?.exclude_component_types)
        ? (rule.conditions.exclude_component_types as string[])
        : ["registration_fee"],
    }))
}

const DEFAULT_SIBLING_RULE: DiscountRuleInput = {
  rule_type: "sibling",
  label: "Sibling Discount",
  discount_type: "percent",
  amount: 10,
  is_active: true,
  priority_rank: 10,
  exclude_component_types: ["registration_fee"],
}

export function ProgramSiblingDiscountEditor({
  discountRules,
  onChange,
  disabled = false,
}: {
  discountRules: ProgramOfferingDiscountRule[]
  onChange?: (rules: DiscountRuleInput[]) => void
  disabled?: boolean
}) {
  const [draftRules, setDraftRules] = React.useState<DiscountRuleInput[]>(() =>
    buildSiblingDiscountRules(discountRules)
  )

  React.useEffect(() => {
    setDraftRules(buildSiblingDiscountRules(discountRules))
  }, [discountRules])

  React.useEffect(() => {
    onChange?.(draftRules)
  }, [draftRules, onChange])

  function updateRules(updater: (current: DiscountRuleInput[]) => DiscountRuleInput[]) {
    setDraftRules(updater)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Sibling discount</p>
          <p className="text-xs text-muted-foreground">
            Applied when a registrant already has a sibling enrolled in this program.
          </p>
        </div>
        {draftRules.length === 0 && !disabled ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => updateRules(() => [DEFAULT_SIBLING_RULE])}
          >
            Add sibling discount
          </Button>
        ) : null}
      </div>

      {draftRules.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead className="w-[120px]">Amount</TableHead>
                <TableHead className="w-[140px]">Type</TableHead>
                <TableHead className="w-[80px]">Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {draftRules.map((rule, index) => (
                <TableRow key={rule.id ?? index}>
                  <TableCell>
                    <Input
                      value={rule.label}
                      disabled={disabled}
                      onChange={(event) =>
                        updateRules((current) =>
                          current.map((row, rowIndex) =>
                            rowIndex === index
                              ? { ...row, label: event.target.value }
                              : row
                          )
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={rule.amount}
                      disabled={disabled}
                      onChange={(event) =>
                        updateRules((current) =>
                          current.map((row, rowIndex) =>
                            rowIndex === index
                              ? {
                                  ...row,
                                  amount: Number(event.target.value || 0),
                                }
                              : row
                          )
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <select
                      value={rule.discount_type}
                      disabled={disabled}
                      onChange={(event) =>
                        updateRules((current) =>
                          current.map((row, rowIndex) =>
                            rowIndex === index
                              ? {
                                  ...row,
                                  discount_type: event.target.value as DiscountRuleInput["discount_type"],
                                }
                              : row
                          )
                        )
                      }
                      className="h-9 w-full rounded-md border bg-background px-2 text-sm disabled:opacity-50"
                    >
                      <option value="percent">Percent</option>
                      <option value="fixed_amount">Fixed Amount</option>
                    </select>
                  </TableCell>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={rule.is_active}
                      disabled={disabled}
                      onChange={(event) =>
                        updateRules((current) =>
                          current.map((row, rowIndex) =>
                            rowIndex === index
                              ? { ...row, is_active: event.target.checked }
                              : row
                          )
                        )
                      }
                      className="h-4 w-4"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No sibling discount configured for this program.
        </p>
      )}
    </div>
  )
}

export function ProgramSiblingDiscountEditorWithSave({
  programId,
  offeringId,
  discountRules,
  onSaved,
}: {
  programId: string
  offeringId: string
  discountRules: ProgramOfferingDiscountRule[]
  onSaved?: () => void
}) {
  const rulesRef = React.useRef<DiscountRuleInput[]>(
    buildSiblingDiscountRules(discountRules)
  )
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)

  React.useEffect(() => {
    rulesRef.current = buildSiblingDiscountRules(discountRules)
  }, [discountRules])

  async function handleSave() {
    setIsSaving(true)
    setError(null)
    setSuccess(false)

    try {
      await saveOfferingSiblingDiscountRules({
        programId,
        offeringId,
        rules: rulesRef.current,
      })
      setSuccess(true)
      onSaved?.()
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save sibling discount."
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <ProgramSiblingDiscountEditor
        discountRules={discountRules}
        onChange={(rules) => {
          rulesRef.current = rules
          setSuccess(false)
        }}
      />
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Sibling discount saved.
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button type="button" onClick={() => void handleSave()} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save sibling discount"
          )}
        </Button>
      </div>
    </div>
  )
}
