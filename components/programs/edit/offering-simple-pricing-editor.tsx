"use client"

import * as React from "react"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { EditSectionCard } from "@/components/programs/edit/edit-section-card"
import type { FeePlanEditorState } from "@/components/programs/program-fee-plan-editor"
import { ProgramBillingScheduleView } from "@/components/programs/program-billing-schedule-view"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  buildFeePlanStateFromSimplePricing,
  createDefaultAddon,
  createDefaultCharge,
  formatPricingCurrency,
  parseSimplePricingFromWorkspace,
  summarizeRequiredCharges,
} from "@/lib/programs/offering-pricing-mapper"
import {
  ADDON_BILLING_METHOD_LABELS,
  CHARGE_TYPE_LABELS,
  PAYMENT_STRUCTURE_LABELS,
  type AddonBillingMethod,
  type ChargeType,
  type OfferingAddon,
  type OfferingCharge,
  type PaymentStructure,
  type SimpleOfferingPricing,
} from "@/lib/programs/offering-pricing-simple-types"
import {
  BILLING_MIGRATION_MESSAGE,
  BILLING_MIGRATION_SCRIPTS,
} from "@/lib/programs/program-billing-schema"
import { saveOfferingPricing } from "@/lib/programs/offering-workspace-actions"
import type { OfferingWorkspaceData } from "@/lib/programs/offering-workspace-types"
import type { ProgramOffering } from "@/lib/programs/program-offering-types"
import type { ProgramRegistrationOption } from "@/lib/programs/program-registration-option-types"
import { cn } from "@/lib/utils"

function buildInitialFeePlanState(
  offering: ProgramOffering,
  workspaceData: OfferingWorkspaceData,
  registrationOptions: ProgramRegistrationOption[]
): FeePlanEditorState {
  const simple = parseSimplePricingFromWorkspace(
    workspaceData.feePlans,
    workspaceData.feePlanComponents
  )

  return buildFeePlanStateFromSimplePricing(simple, offering.name, {
    plans: workspaceData.feePlans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      plan_type: plan.plan_type,
      is_default: plan.is_default,
      is_active: plan.is_active,
      deposit_amount: Number(plan.deposit_amount || 0),
      payment_due_day: plan.payment_due_day,
      installment_count: plan.installment_count,
      notes: plan.notes,
      components: workspaceData.feePlanComponents
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
    })),
    discountRules: workspaceData.feePlanDiscountRules.map((rule) => ({
      id: rule.id,
      rule_type: rule.rule_type,
      label: rule.label,
      discount_type: rule.discount_type,
      amount: Number(rule.amount || 0),
      fee_plan_id: rule.fee_plan_id,
      is_active: rule.is_active,
      priority_rank: rule.priority_rank,
      exclude_component_types: Array.isArray(
        rule.conditions?.exclude_component_types
      )
        ? (rule.conditions.exclude_component_types as string[])
        : ["registration_fee"],
    })),
    optionFeePlanLinks: registrationOptions.map((option) => ({
      optionId: option.id,
      feePlanId: option.fee_plan_id ?? null,
    })),
  })
}

function ChargeRow({
  charge,
  onChange,
  onRemove,
}: {
  charge: OfferingCharge
  onChange: (next: OfferingCharge) => void
  onRemove: () => void
}) {
  return (
    <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto_auto] sm:items-end">
      <div className="space-y-1.5">
        <Label className="text-xs">Charge Name</Label>
        <Input
          value={charge.name}
          onChange={(event) => onChange({ ...charge, name: event.target.value })}
          placeholder="Tuition"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Amount</Label>
        <Input
          type="number"
          min="0"
          step="0.01"
          value={charge.amount}
          onChange={(event) =>
            onChange({ ...charge, amount: Number(event.target.value || 0) })
          }
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Charge Type</Label>
        <select
          value={charge.chargeType}
          onChange={(event) =>
            onChange({ ...charge, chargeType: event.target.value as ChargeType })
          }
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
        >
          {Object.entries(CHARGE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 pb-2 text-sm">
        <Checkbox
          checked={charge.required}
          onCheckedChange={(checked) =>
            onChange({ ...charge, required: checked === true })
          }
        />
        Required
      </label>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="shrink-0 text-destructive hover:text-destructive"
        onClick={onRemove}
        aria-label={`Remove ${charge.name || "charge"}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

function AddonRow({
  addon,
  onChange,
  onRemove,
}: {
  addon: OfferingAddon
  onChange: (next: OfferingAddon) => void
  onRemove: () => void
}) {
  return (
    <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto] sm:items-end">
      <div className="space-y-1.5">
        <Label className="text-xs">Name</Label>
        <Input
          value={addon.name}
          onChange={(event) => onChange({ ...addon, name: event.target.value })}
          placeholder="Before Care"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Amount</Label>
        <Input
          type="number"
          min="0"
          step="0.01"
          value={addon.amount}
          onChange={(event) =>
            onChange({ ...addon, amount: Number(event.target.value || 0) })
          }
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Billing Method</Label>
        <select
          value={addon.billingMethod}
          onChange={(event) =>
            onChange({
              ...addon,
              billingMethod: event.target.value as AddonBillingMethod,
            })
          }
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
        >
          {Object.entries(ADDON_BILLING_METHOD_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="shrink-0 text-destructive hover:text-destructive"
        onClick={onRemove}
        aria-label={`Remove ${addon.name || "add-on"}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function OfferingSimplePricingEditor({
  programId,
  offering,
  workspaceData,
  registrationOptions,
  showSaveButton = true,
  onBeforeSave,
}: {
  programId: string
  offering: ProgramOffering
  workspaceData: OfferingWorkspaceData
  registrationOptions: ProgramRegistrationOption[]
  showSaveButton?: boolean
  /** Run before pricing save (e.g. registration settings on manage Enrollment). */
  onBeforeSave?: () => Promise<boolean>
}) {
  const router = useRouter()
  const feePlanStateRef = React.useRef<FeePlanEditorState>(
    buildInitialFeePlanState(offering, workspaceData, registrationOptions)
  )

  const [pricing, setPricing] = React.useState<SimpleOfferingPricing>(() =>
    parseSimplePricingFromWorkspace(
      workspaceData.feePlans,
      workspaceData.feePlanComponents
    )
  )
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState(false)

  const workspacePricingSignature = React.useMemo(
    () =>
      JSON.stringify({
        plans: workspaceData.feePlans.map((plan) => [
          plan.id,
          plan.plan_type,
          plan.updated_at,
        ]),
        components: workspaceData.feePlanComponents.map((component) => [
          component.id,
          component.label,
          component.amount,
          component.is_active,
          component.component_type,
        ]),
      }),
    [workspaceData.feePlanComponents, workspaceData.feePlans]
  )

  React.useEffect(() => {
    const nextPricing = parseSimplePricingFromWorkspace(
      workspaceData.feePlans,
      workspaceData.feePlanComponents
    )
    setPricing(nextPricing)
    feePlanStateRef.current = buildInitialFeePlanState(
      offering,
      workspaceData,
      registrationOptions
    )
  }, [offering.id, workspacePricingSignature])

  const requiredTotal = summarizeRequiredCharges(pricing.charges)
  const billingBundle = workspaceData.billingSchedule.bundle
  const billingMigrationRequired = workspaceData.billingSchedule.migrationRequired
  const showBillingSchedule =
    pricing.paymentStructure === "monthly" ||
    pricing.paymentStructure === "installments"

  function updatePricing(
    updater: (current: SimpleOfferingPricing) => SimpleOfferingPricing
  ) {
    setPricing((current) => {
      const next = updater(current)
      feePlanStateRef.current = buildFeePlanStateFromSimplePricing(
        next,
        offering.name,
        feePlanStateRef.current
      )
      return next
    })
    setSuccess(false)
  }

  async function handleSave() {
    setIsSaving(true)
    setError(null)
    setSuccess(false)

    try {
      if (onBeforeSave) {
        const ok = await onBeforeSave()
        if (!ok) {
          setIsSaving(false)
          return
        }
      }

      await saveOfferingPricing({
        programId,
        offeringId: offering.id,
        plans: feePlanStateRef.current.plans,
        discountRules: feePlanStateRef.current.discountRules,
        optionFeePlanLinks: feePlanStateRef.current.optionFeePlanLinks,
      })
      setSuccess(true)
      router.refresh()
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to save pricing."
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Pricing</h3>
        <p className="text-sm text-muted-foreground">
          What will families be charged for {offering.name}?
        </p>
        {requiredTotal > 0 ? (
          <p className="text-sm font-medium">
            Required charges total: {formatPricingCurrency(requiredTotal)}
          </p>
        ) : null}
      </div>

      <EditSectionCard
        title="Charges"
        description="Core program fees families pay when registering."
      >
        <div className="space-y-3">
          {pricing.charges.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No charges yet. Add tuition, registration fees, and other required
              costs.
            </p>
          ) : (
            pricing.charges.map((charge) => (
              <ChargeRow
                key={charge.clientId}
                charge={charge}
                onChange={(next) =>
                  updatePricing((current) => ({
                    ...current,
                    charges: current.charges.map((item) =>
                      item.clientId === charge.clientId ? next : item
                    ),
                  }))
                }
                onRemove={() =>
                  updatePricing((current) => ({
                    ...current,
                    charges: current.charges.filter(
                      (item) => item.clientId !== charge.clientId
                    ),
                  }))
                }
              />
            ))
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              updatePricing((current) => ({
                ...current,
                charges: [...current.charges, createDefaultCharge("tuition")],
              }))
            }
          >
            <Plus className="mr-1 h-4 w-4" />
            Add Charge
          </Button>
        </div>
      </EditSectionCard>

      <EditSectionCard
        title="Optional Add-Ons"
        description="Extra services families can choose during registration."
      >
        <div className="space-y-3">
          {pricing.addons.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No add-ons yet. Examples: before care, after care, lunch.
            </p>
          ) : (
            pricing.addons.map((addon) => (
              <AddonRow
                key={addon.clientId}
                addon={addon}
                onChange={(next) =>
                  updatePricing((current) => ({
                    ...current,
                    addons: current.addons.map((item) =>
                      item.clientId === addon.clientId ? next : item
                    ),
                  }))
                }
                onRemove={() =>
                  updatePricing((current) => ({
                    ...current,
                    addons: current.addons.filter(
                      (item) => item.clientId !== addon.clientId
                    ),
                  }))
                }
              />
            ))
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              updatePricing((current) => ({
                ...current,
                addons: [...current.addons, createDefaultAddon()],
              }))
            }
          >
            <Plus className="mr-1 h-4 w-4" />
            Add Add-On
          </Button>
        </div>
      </EditSectionCard>

      <EditSectionCard
        title="Payment Structure"
        description="How families pay for required charges."
      >
        <div className="space-y-4">
          <RadioGroup
            value={pricing.paymentStructure}
            onValueChange={(value) =>
              updatePricing((current) => ({
                ...current,
                paymentStructure: value as PaymentStructure,
                installmentCount:
                  value === "installments" ? current.installmentCount ?? 2 : null,
                paymentDueDay:
                  value === "monthly" ? current.paymentDueDay ?? 1 : null,
              }))
            }
            className="grid gap-3 sm:grid-cols-3"
          >
            {Object.entries(PAYMENT_STRUCTURE_LABELS).map(([value, label]) => (
              <label
                key={value}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border p-3",
                  pricing.paymentStructure === value && "border-primary bg-primary/5"
                )}
              >
                <RadioGroupItem value={value} />
                <span className="text-sm font-medium">{label}</span>
              </label>
            ))}
          </RadioGroup>

          {pricing.paymentStructure === "installments" ? (
            <div className="max-w-xs space-y-1.5">
              <Label htmlFor="installment-count">Number of installments</Label>
              <Input
                id="installment-count"
                type="number"
                min="2"
                max="24"
                value={pricing.installmentCount ?? 2}
                onChange={(event) =>
                  updatePricing((current) => ({
                    ...current,
                    installmentCount: Math.max(
                      2,
                      Number(event.target.value || 2)
                    ),
                  }))
                }
              />
            </div>
          ) : null}

          {pricing.paymentStructure === "monthly" ? (
            <div className="max-w-xs space-y-1.5">
              <Label htmlFor="payment-due-day">Payment due day (1–28)</Label>
              <Input
                id="payment-due-day"
                type="number"
                min="1"
                max="28"
                value={pricing.paymentDueDay ?? 1}
                onChange={(event) =>
                  updatePricing((current) => ({
                    ...current,
                    paymentDueDay: Math.min(
                      28,
                      Math.max(1, Number(event.target.value || 1))
                    ),
                  }))
                }
              />
            </div>
          ) : null}
        </div>
      </EditSectionCard>

      {showBillingSchedule ? (
        <EditSectionCard
          title="Billing Schedule"
          description="Monthly billing calendar generated from program dates and payment structure."
        >
          {billingMigrationRequired ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-950">
              <p className="font-medium">Database migration required</p>
              <p className="mt-2">{BILLING_MIGRATION_MESSAGE}</p>
            </div>
          ) : !billingBundle ? (
            <p className="text-sm text-muted-foreground">
              Set program start and end dates on the Overview tab to generate
              the billing calendar.
            </p>
          ) : (
            <ProgramBillingScheduleView
              programId={programId}
              bundle={billingBundle}
              readOnly={billingMigrationRequired}
              showParticipants={false}
            />
          )}
        </EditSectionCard>
      ) : null}

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Pricing saved for {offering.name}.
        </p>
      ) : null}

      {showSaveButton ? (
        <div className="flex justify-end border-t pt-4">
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
