"use client"

import * as React from "react"
import Link from "next/link"
import { Trash2 } from "lucide-react"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import {
  FEE_COMPONENT_TYPE_LABELS,
  FEE_PLAN_TYPE_LABELS,
} from "@/lib/programs/program-fee-plan-types"
import type { ProgramRegistrationOption } from "@/lib/programs/program-registration-option-types"
import { REGISTRATION_OPTION_LABELS } from "@/lib/programs/program-registration-option-types"

export type FeePlanEditorState = {
  plans: FeePlanInput[]
  discountRules: DiscountRuleInput[]
  optionFeePlanLinks: Array<{ optionId: string; feePlanId: string | null }>
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function hasPersistedProgramContext(programId: string, offeringId: string) {
  return UUID_PATTERN.test(programId) && UUID_PATTERN.test(offeringId)
}

function sanitizePaymentDueDay(
  planType: FeePlanType,
  value: number | null | undefined
): number | null {
  if (planType !== "monthly" || value == null || Number.isNaN(Number(value))) {
    return null
  }

  const day = Math.round(Number(value))
  if (day < 1 || day > 28) {
    return null
  }

  return day
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
    payment_due_day: sanitizePaymentDueDay(plan.plan_type, plan.payment_due_day),
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

function buildInitialDiscountRules(
  rules: ProgramOfferingDiscountRule[]
): DiscountRuleInput[] {
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

const DEFAULT_FEE_PLAN_VALUE = "__offering_default__"

function RegistrationOptionFeePlanSelect({
  feePlanId,
  planOptions,
  defaultPlanLabel,
  onChange,
}: {
  feePlanId: string | null
  planOptions: Array<{ id: string; label: string }>
  defaultPlanLabel: string
  onChange: (feePlanId: string | null) => void
}) {
  const selectValue = feePlanId ?? DEFAULT_FEE_PLAN_VALUE
  const persistedPlans = planOptions.filter(
    (plan) => !plan.id.startsWith("draft-")
  )

  return (
    <Select
      value={selectValue}
      onValueChange={(value) =>
        onChange(value === DEFAULT_FEE_PLAN_VALUE ? null : value)
      }
    >
      <SelectTrigger className="w-full max-w-none">
        <SelectValue placeholder="Choose a fee plan" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={DEFAULT_FEE_PLAN_VALUE}>
          Use program default
          {defaultPlanLabel ? ` (${defaultPlanLabel})` : ""}
        </SelectItem>
        {persistedPlans.map((plan) => (
          <SelectItem key={plan.id} value={plan.id}>
            {plan.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function ProgramFeePlanEditor({
  programId,
  offeringId,
  plans,
  components,
  discountRules,
  registrationOptions,
  onChange,
  draftMode = false,
  showBillingScheduleLink = true,
}: {
  programId: string
  offeringId: string
  plans: ProgramOfferingFeePlan[]
  components: ProgramOfferingFeePlanComponent[]
  discountRules: ProgramOfferingDiscountRule[]
  registrationOptions: ProgramRegistrationOption[]
  onChange: (state: FeePlanEditorState) => void
  draftMode?: boolean
  showBillingScheduleLink?: boolean
}) {
  const canLinkBillingSchedule =
    !draftMode && hasPersistedProgramContext(programId, offeringId)
  const [draftPlans, setDraftPlans] = React.useState<FeePlanInput[]>(() =>
    buildInitialPlans(plans, components)
  )
  const preservedDiscountRules = React.useMemo(
    () => buildInitialDiscountRules(discountRules),
    [discountRules]
  )
  const [optionLinks, setOptionLinks] = React.useState<
    Array<{ optionId: string; feePlanId: string | null }>
  >(() =>
    registrationOptions.map((option) => ({
      optionId: option.id,
      feePlanId: option.fee_plan_id ?? null,
    }))
  )

  const planOptions = draftPlans.map((plan, index) => ({
    id: plan.id ?? `draft-${index}`,
    label: plan.name,
  }))
  const defaultPlanLabel =
    draftPlans.find((plan) => plan.is_default)?.name ??
    draftPlans[0]?.name ??
    ""

  const sortedRegistrationOptions = React.useMemo(
    () =>
      [...registrationOptions].sort((left, right) => {
        if (left.is_active === right.is_active) {
          return left.priority_rank - right.priority_rank
        }

        return left.is_active ? -1 : 1
      }),
    [registrationOptions]
  )

  const activeRegistrationOptionCount = registrationOptions.filter(
    (option) => option.is_active
  ).length

  React.useEffect(() => {
    setDraftPlans(buildInitialPlans(plans, components))
    setOptionLinks(
      registrationOptions.map((option) => ({
        optionId: option.id,
        feePlanId: option.fee_plan_id ?? null,
      }))
    )
  }, [plans, components, registrationOptions])

  React.useEffect(() => {
    onChange({
      plans: draftPlans,
      discountRules: preservedDiscountRules,
      optionFeePlanLinks: optionLinks,
    })
  }, [draftPlans, preservedDiscountRules, optionLinks])

  function updatePlan(index: number, patch: Partial<FeePlanInput>) {
    setDraftPlans((current) =>
      current.map((plan, planIndex) => {
        if (planIndex !== index) return plan

        const nextPlan = { ...plan, ...patch }

        if (patch.plan_type && patch.plan_type !== "monthly") {
          nextPlan.payment_due_day = null
        }

        if (patch.plan_type && patch.plan_type !== "installments") {
          nextPlan.installment_count = null
        }

        return nextPlan
      })
    )
  }

  function updateComponent(
    planIndex: number,
    componentIndex: number,
    patch: Partial<FeePlanComponentInput>
  ) {
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

  function removeComponent(planIndex: number, componentIndex: number) {
    setDraftPlans((current) =>
      current.map((plan, idx) =>
        idx === planIndex
          ? {
              ...plan,
              components: plan.components.filter(
                (_, cIdx) => cIdx !== componentIndex
              ),
            }
          : plan
      )
    )
  }

  return (
    <Card>
      <CardHeader className="gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base">Fee Plans</CardTitle>
          <CardDescription className="text-xs">
            Fee Plans are the source of truth for registration pricing.
          </CardDescription>
        </div>

        {showBillingScheduleLink && canLinkBillingSchedule ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={`#billing-schedule`}>View Billing Schedule</Link>
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-4 px-4 pb-4 pt-0">
        {registrationOptions.length > 0 ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">Registration pricing</p>
              <p className="text-xs text-muted-foreground">
                Each registration type on the Registration tab can use the
                program&apos;s default fee plan or a specific plan below. Pick a
                plan for each enabled type, then click Save pricing.
              </p>
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Registration type</TableHead>
                    <TableHead className="w-[320px]">Fee plan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRegistrationOptions.map((option) => {
                    const link = optionLinks.find((row) => row.optionId === option.id)
                    const optionLabel =
                      option.name ||
                      REGISTRATION_OPTION_LABELS[option.option_type]

                    return (
                      <TableRow
                        key={option.id}
                        className={option.is_active ? undefined : "opacity-60"}
                      >
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">{optionLabel}</p>
                            {option.is_active ? (
                              <p className="text-xs text-muted-foreground">
                                Enabled on Registration tab
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                Not enabled — turn on under Registration to use
                                this mapping
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <RegistrationOptionFeePlanSelect
                            feePlanId={link?.feePlanId ?? null}
                            planOptions={planOptions}
                            defaultPlanLabel={defaultPlanLabel}
                            onChange={(nextFeePlanId) =>
                              setOptionLinks((current) =>
                                current.map((row) =>
                                  row.optionId === option.id
                                    ? { ...row, feePlanId: nextFeePlanId }
                                    : row
                                )
                              )
                            }
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            {activeRegistrationOptionCount === 0 ? (
              <p className="text-xs text-amber-800">
                No registration types are enabled yet. Open the Registration
                tab to turn on Full Program or session-based registration.
              </p>
            ) : null}
          </div>
        ) : null}

        {draftPlans.map((plan, planIndex) => (
          <div key={plan.id ?? planIndex} className="space-y-4 rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={plan.is_default ? "default" : "outline"}>
                {plan.is_default ? "Default" : "Additional"}
              </Badge>
              <Badge variant="secondary">{FEE_PLAN_TYPE_LABELS[plan.plan_type]}</Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Plan Name</Label>
                <Input
                  value={plan.name}
                  onChange={(event) =>
                    updatePlan(planIndex, { name: event.target.value })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Plan Type</Label>
                <select
                  value={plan.plan_type}
                  onChange={(event) =>
                    updatePlan(planIndex, {
                      plan_type: event.target.value as FeePlanType,
                    })
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
                <div className="space-y-1.5">
                  <Label className="text-xs">Deposit Amount</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={plan.deposit_amount}
                    onChange={(event) =>
                      updatePlan(planIndex, {
                        deposit_amount: Number(event.target.value || 0),
                      })
                    }
                  />
                </div>
              ) : null}

              {plan.plan_type === "monthly" ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">Payment Due Day (1–28) *</Label>
                  <Input
                    type="number"
                    min="1"
                    max="28"
                    required
                    value={plan.payment_due_day ?? ""}
                    onChange={(event) => {
                      const raw = event.target.value
                      if (!raw) {
                        updatePlan(planIndex, { payment_due_day: null })
                        return
                      }

                      const day = Math.min(
                        28,
                        Math.max(1, Math.round(Number(raw) || 1))
                      )
                      updatePlan(planIndex, { payment_due_day: day })
                    }}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Day of each month when monthly tuition is due.
                  </p>
                </div>
              ) : null}

              {plan.plan_type === "installments" ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">Installment Count</Label>
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

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Components</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addComponent(planIndex)}
                >
                  Add Component
                </Button>
              </div>

              {plan.components.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No components configured.
                </p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px]">Type</TableHead>
                        <TableHead>Label</TableHead>
                        <TableHead className="w-[120px]">Amount</TableHead>
                        <TableHead className="w-[160px]">Pricing</TableHead>
                        <TableHead className="w-[72px] text-right">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plan.components.map((component, componentIndex) => (
                        <TableRow key={componentIndex}>
                          <TableCell>
                            <select
                              value={component.component_type}
                              onChange={(event) =>
                                updateComponent(planIndex, componentIndex, {
                                  component_type: event.target
                                    .value as FeePlanComponentInput["component_type"],
                                })
                              }
                              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                            >
                              {Object.entries(FEE_COMPONENT_TYPE_LABELS).map(
                                ([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                )
                              )}
                            </select>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={component.label}
                              onChange={(event) =>
                                updateComponent(planIndex, componentIndex, {
                                  label: event.target.value,
                                })
                              }
                            />
                          </TableCell>
                          <TableCell>
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
                          </TableCell>
                          <TableCell>
                            <select
                              value={component.pricing_model}
                              onChange={(event) =>
                                updateComponent(planIndex, componentIndex, {
                                  pricing_model: event.target
                                    .value as FeePlanComponentInput["pricing_model"],
                                })
                              }
                              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                            >
                              <option value="flat">Flat</option>
                              <option value="per_session">Per Session</option>
                              <option value="per_month">Per Month</option>
                              <option value="percent_of_tuition">
                                Percent of Tuition
                              </option>
                            </select>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() =>
                                removeComponent(planIndex, componentIndex)
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        ))}

      </CardContent>
    </Card>
  )
}
