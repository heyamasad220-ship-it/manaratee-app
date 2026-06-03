"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type {
  DiscountRuleInput,
  FeePlanComponentInput,
  FeePlanInput,
} from "@/lib/programs/program-fee-plan-actions"
import type {
  ProgramOfferingDiscountRule,
  ProgramOfferingFeePlan,
  ProgramOfferingFeePlanComponent,
  FeePlanType,
} from "@/lib/programs/program-fee-plan-types"
import { FEE_COMPONENT_TYPE_LABELS, FEE_PLAN_TYPE_LABELS } from "@/lib/programs/program-fee-plan-types"
import type { ProgramRegistrationOption } from "@/lib/programs/program-registration-option-types"
import { REGISTRATION_OPTION_LABELS } from "@/lib/programs/program-registration-option-types"
import { quoteProgramRegistration } from "@/lib/programs/program-quote-actions"
import type { ProgramRegistrationQuote } from "@/lib/programs/program-quote-types"

export type FeePlanEditorState = {
  plans: FeePlanInput[]
  discountRules: DiscountRuleInput[]
  optionFeePlanLinks: Array<{ optionId: string; feePlanId: string | null }>
}

function formatMoney(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value)
}

function buildInitialPlans(
  plans: ProgramOfferingFeePlan[],
  components: ProgramOfferingFeePlanComponent[]
): FeePlanInput[] {
  if (plans.length === 0) {
    return [
      {
        name: "Default Fee Plan",
        plan_type: "free",
        is_default: true,
        is_active: true,
        deposit_amount: 0,
        payment_due_day: null,
        installment_count: null,
        components: [],
      },
    ]
  }

  return plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    plan_type: plan.plan_type,
    is_default: plan.is_default,
    is_active: plan.is_active,
    deposit_amount: Number(plan.deposit_amount || 0),
    payment_due_day: plan.payment_due_day,
    installment_count: plan.installment_count,
    notes: plan.notes,
    components: components
      .filter((component) => component.fee_plan_id === plan.id)
      .map((component) => ({
        id: component.id,
        component_type: component.component_type,
        label: component.label,
        amount: Number(component.amount || 0),
        pricing_model: component.pricing_model,
        quantity_mode: component.quantity_mode,
        quantity_value: Number(component.quantity_value || 1),
        addon_key: component.addon_key,
        session_price_source: component.session_price_source,
        applies_to_option_types: component.applies_to_option_types,
        sort_order: component.sort_order,
        is_active: component.is_active,
      })),
  }))
}

function buildInitialDiscountRules(rules: ProgramOfferingDiscountRule[]): DiscountRuleInput[] {
  return rules.map((rule) => ({
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

function emptyComponent(sortOrder: number): FeePlanComponentInput {
  return {
    component_type: "custom",
    label: "",
    amount: 0,
    pricing_model: "flat",
    quantity_mode: "fixed",
    quantity_value: 1,
    sort_order: sortOrder,
    is_active: true,
  }
}

export function ProgramFeePlanEditor({
  programId,
  offeringId,
  organizationId,
  plans,
  components,
  discountRules,
  registrationOptions,
  onChange,
}: {
  programId: string
  offeringId: string
  organizationId: string
  plans: ProgramOfferingFeePlan[]
  components: ProgramOfferingFeePlanComponent[]
  discountRules: ProgramOfferingDiscountRule[]
  registrationOptions: ProgramRegistrationOption[]
  onChange: (state: FeePlanEditorState) => void
}) {
  const [draftPlans, setDraftPlans] = React.useState<FeePlanInput[]>(() =>
    buildInitialPlans(plans, components)
  )
  const [draftDiscountRules, setDraftDiscountRules] = React.useState<DiscountRuleInput[]>(() =>
    buildInitialDiscountRules(discountRules)
  )
  const [optionLinks, setOptionLinks] = React.useState<
    Array<{ optionId: string; feePlanId: string | null }>
  >(() =>
    registrationOptions.map((option) => ({
      optionId: option.id,
      feePlanId: option.fee_plan_id ?? null,
    }))
  )
  const [previewQuote, setPreviewQuote] = React.useState<ProgramRegistrationQuote | null>(null)
  const [previewLoading, setPreviewLoading] = React.useState(false)

  const planOptions = draftPlans.map((plan, index) => ({
    id: plan.id ?? `draft-${index}`,
    label: plan.name,
  }))

  React.useEffect(() => {
    onChange({
      plans: draftPlans,
      discountRules: draftDiscountRules,
      optionFeePlanLinks: optionLinks,
    })
  }, [draftPlans, draftDiscountRules, optionLinks])

  const defaultPlan = draftPlans.find((plan) => plan.is_default) ?? draftPlans[0]

  async function loadPreview() {
    const fullProgramOption = registrationOptions.find(
      (option) => option.option_type === "full_program"
    )

    if (!fullProgramOption) {
      setPreviewQuote(null)
      return
    }

    setPreviewLoading(true)

    try {
      const quote = await quoteProgramRegistration({
        organizationId,
        programId,
        offeringId,
        registrationOptionId: fullProgramOption.id,
        sessionIds: [],
        addons: {},
      })
      setPreviewQuote(quote)
    } catch {
      setPreviewQuote(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  React.useEffect(() => {
    void loadPreview()
  }, [draftPlans, draftDiscountRules])

  function updatePlan(index: number, patch: Partial<FeePlanInput>) {
    setDraftPlans((current) =>
      current.map((plan, planIndex) =>
        planIndex === index ? { ...plan, ...patch } : plan
      )
    )
  }

  function updateComponent(planIndex: number, componentIndex: number, patch: Partial<FeePlanComponentInput>) {
    setDraftPlans((current) =>
      current.map((plan, idx) => {
        if (idx !== planIndex) return plan
        const nextComponents = plan.components.map((component, cIdx) =>
          cIdx === componentIndex ? { ...component, ...patch } : component
        )
        return { ...plan, components: nextComponents }
      })
    )
  }

  function addComponent(planIndex: number) {
    setDraftPlans((current) =>
      current.map((plan, idx) =>
        idx === planIndex
          ? {
              ...plan,
              components: [
                ...plan.components,
                emptyComponent((plan.components.length + 1) * 10),
              ],
            }
          : plan
      )
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Offering Fee Plans</CardTitle>
        <CardDescription>
          Pricing for the default offering. Registration options can link to a
          specific plan. Legacy program billing fields remain for reference until
          Phase 2B.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {draftPlans.map((plan, planIndex) => (
          <div key={plan.id ?? planIndex} className="space-y-4 rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={plan.is_default ? "default" : "outline"}>
                {plan.is_default ? "Default" : "Additional"}
              </Badge>
              <Badge variant="secondary">{FEE_PLAN_TYPE_LABELS[plan.plan_type]}</Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Plan Name</Label>
                <Input
                  value={plan.name}
                  onChange={(event) => updatePlan(planIndex, { name: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Plan Type</Label>
                <select
                  value={plan.plan_type}
                  onChange={(event) =>
                    updatePlan(planIndex, { plan_type: event.target.value as FeePlanType })
                  }
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {Object.entries(FEE_PLAN_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {plan.plan_type === "deposit_balance" ? (
                <div className="space-y-2">
                  <Label>Deposit Amount</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={plan.deposit_amount}
                    onChange={(event) =>
                      updatePlan(planIndex, { deposit_amount: Number(event.target.value || 0) })
                    }
                  />
                </div>
              ) : null}

              {plan.plan_type === "monthly" ? (
                <div className="space-y-2">
                  <Label>Payment Due Day</Label>
                  <Input
                    type="number"
                    min="1"
                    max="28"
                    value={plan.payment_due_day ?? ""}
                    onChange={(event) =>
                      updatePlan(planIndex, {
                        payment_due_day: event.target.value
                          ? Number(event.target.value)
                          : null,
                      })
                    }
                  />
                </div>
              ) : null}

              {plan.plan_type === "installments" ? (
                <div className="space-y-2">
                  <Label>Installment Count</Label>
                  <Input
                    type="number"
                    min="1"
                    value={plan.installment_count ?? ""}
                    onChange={(event) =>
                      updatePlan(planIndex, {
                        installment_count: event.target.value
                          ? Number(event.target.value)
                          : null,
                      })
                    }
                  />
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Components</p>
                <Button type="button" variant="outline" size="sm" onClick={() => addComponent(planIndex)}>
                  Add Component
                </Button>
              </div>

              {plan.components.length === 0 ? (
                <p className="text-sm text-muted-foreground">No components configured.</p>
              ) : (
                plan.components.map((component, componentIndex) => (
                  <div key={componentIndex} className="grid gap-3 rounded-md border p-3 md:grid-cols-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Type</Label>
                      <select
                        value={component.component_type}
                        onChange={(event) =>
                          updateComponent(planIndex, componentIndex, {
                            component_type: event.target.value as FeePlanComponentInput["component_type"],
                          })
                        }
                        className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                      >
                        {Object.entries(FEE_COMPONENT_TYPE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Label</Label>
                      <Input
                        value={component.label}
                        onChange={(event) =>
                          updateComponent(planIndex, componentIndex, { label: event.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Amount</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={component.amount}
                        onChange={(event) =>
                          updateComponent(planIndex, componentIndex, {
                            amount: Number(event.target.value || 0),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Pricing</Label>
                      <select
                        value={component.pricing_model}
                        onChange={(event) =>
                          updateComponent(planIndex, componentIndex, {
                            pricing_model: event.target.value as FeePlanComponentInput["pricing_model"],
                          })
                        }
                        className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                      >
                        <option value="flat">Flat</option>
                        <option value="per_session">Per Session</option>
                        <option value="per_month">Per Month</option>
                        <option value="percent_of_tuition">Percent of Tuition</option>
                      </select>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}

        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-sm font-medium">Sibling Discount Rule</p>
          {draftDiscountRules.length === 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setDraftDiscountRules([
                  {
                    rule_type: "sibling",
                    label: "Sibling Discount",
                    discount_type: "percent",
                    amount: 10,
                    is_active: true,
                    priority_rank: 10,
                    exclude_component_types: ["registration_fee"],
                  },
                ])
              }
            >
              Add Sibling Discount
            </Button>
          ) : (
            draftDiscountRules.map((rule, index) => (
              <div key={index} className="grid gap-3 md:grid-cols-4">
                <Input
                  value={rule.label}
                  onChange={(event) =>
                    setDraftDiscountRules((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index ? { ...row, label: event.target.value } : row
                      )
                    )
                  }
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={rule.amount}
                  onChange={(event) =>
                    setDraftDiscountRules((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index
                          ? { ...row, amount: Number(event.target.value || 0) }
                          : row
                      )
                    )
                  }
                />
                <select
                  value={rule.discount_type}
                  onChange={(event) =>
                    setDraftDiscountRules((current) =>
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
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="percent">Percent</option>
                  <option value="fixed_amount">Fixed Amount</option>
                </select>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={rule.is_active}
                    onChange={(event) =>
                      setDraftDiscountRules((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, is_active: event.target.checked } : row
                        )
                      )
                    }
                  />
                  Active
                </label>
              </div>
            ))
          )}
        </div>

        {registrationOptions.length > 0 ? (
          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-sm font-medium">Registration Option Fee Plans</p>
            {registrationOptions.map((option) => {
              const link = optionLinks.find((row) => row.optionId === option.id)
              return (
                <div key={option.id} className="grid gap-2 md:grid-cols-2 md:items-center">
                  <span className="text-sm">
                    {option.name || REGISTRATION_OPTION_LABELS[option.option_type]}
                  </span>
                  <select
                    value={link?.feePlanId ?? ""}
                    onChange={(event) =>
                      setOptionLinks((current) =>
                        current.map((row) =>
                          row.optionId === option.id
                            ? {
                                ...row,
                                feePlanId: event.target.value ? event.target.value : null,
                              }
                            : row
                        )
                      )
                    }
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">Use offering default</option>
                    {planOptions.map((plan) => (
                      <option key={plan.id} value={plan.id.startsWith("draft-") ? "" : plan.id}>
                        {plan.label}
                      </option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        ) : null}

        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium">Schedule Preview (full program)</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void loadPreview()}>
              Refresh
            </Button>
          </div>

          {previewLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Calculating quote...
            </div>
          ) : previewQuote ? (
            <div className="space-y-2 text-sm">
              <p>
                Total: <strong>{formatMoney(previewQuote.total, previewQuote.currency)}</strong>
              </p>
              <p>
                Due today:{" "}
                <strong>{formatMoney(previewQuote.due_today, previewQuote.currency)}</strong>
              </p>
              {previewQuote.scheduled_payments.length > 0 ? (
                <ul className="space-y-1 text-muted-foreground">
                  {previewQuote.scheduled_payments.map((payment, index) => (
                    <li key={index}>
                      {payment.label}: {formatMoney(payment.amount, previewQuote.currency)} on{" "}
                      {payment.due_date}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Save fee plans to preview the payment schedule.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
