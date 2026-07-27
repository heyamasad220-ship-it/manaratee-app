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
import { Switch } from "@/components/ui/switch"
import {
  buildFeePlanStateFromSimplePricing,
  countOfferingBillingMonths,
  createDefaultFee,
  formatPricingCurrency,
  parseSimplePricingFromWorkspace,
  summarizeRequiredCharges,
} from "@/lib/programs/offering-pricing-mapper"
import {
  FEE_BILLING_SCOPE_LABELS,
  FEE_RECURRENCE_LABELS,
  FEE_TYPE_LABELS,
  PAYMENT_STRUCTURE_LABELS,
  defaultFeeName,
  type ChargeType,
  type FeeBillingScope,
  type FeeRecurrence,
  type OfferingFee,
  type PaymentStructure,
  type SimpleOfferingPricing,
  type SimplePricingDiscountLine,
  type SimplePricingDiscounts,
} from "@/lib/programs/offering-pricing-simple-types"
import { BILLING_MIGRATION_MESSAGE } from "@/lib/programs/program-billing-schema"
import { saveOfferingPricing } from "@/lib/programs/offering-workspace-actions"
import type { OfferingWorkspaceData } from "@/lib/programs/offering-workspace-types"
import type { ProgramOffering } from "@/lib/programs/program-offering-types"
import type { ProgramRegistrationOption } from "@/lib/programs/program-registration-option-types"
import { cn } from "@/lib/utils"

type DiscountTagOption = { id: string; name: string }

type OfferingPricingEditorContextValue = {
  offering: ProgramOffering
  programId: string
  pricing: SimpleOfferingPricing
  updatePricing: (
    updater: (current: SimpleOfferingPricing) => SimpleOfferingPricing
  ) => void
  requiredTotal: number
  billingMonths: number
  discountTags: DiscountTagOption[]
  billingBundle: OfferingWorkspaceData["billingSchedule"]["bundle"]
  billingMigrationRequired: boolean
  showBillingSchedule: boolean
  isSaving: boolean
  error: string | null
  success: boolean
  handleSave: () => Promise<boolean>
}

const OfferingPricingEditorContext =
  React.createContext<OfferingPricingEditorContextValue | null>(null)

function useOfferingPricingEditor() {
  const context = React.useContext(OfferingPricingEditorContext)
  if (!context) {
    throw new Error(
      "Offering pricing sections must be used within OfferingPricingEditorProvider"
    )
  }
  return context
}

function buildInitialFeePlanState(
  offering: ProgramOffering,
  workspaceData: OfferingWorkspaceData,
  registrationOptions: ProgramRegistrationOption[]
): FeePlanEditorState {
  const simple = parseSimplePricingFromWorkspace(
    workspaceData.feePlans,
    workspaceData.feePlanComponents,
    workspaceData.feePlanDiscountRules
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
          billing_scope: component.billing_scope ?? "individual",
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
      conditions: rule.conditions || {},
    })),
    optionFeePlanLinks: registrationOptions.map((option) => ({
      optionId: option.id,
      feePlanId: option.fee_plan_id ?? null,
    })),
  })
}

function FeeRow({
  fee,
  onChange,
  onRemove,
}: {
  fee: OfferingFee
  onChange: (next: OfferingFee) => void
  onRemove: () => void
}) {
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.7fr)] sm:items-end">
        <div className="space-y-1.5">
          <Label className="text-xs">Type</Label>
          <select
            value={fee.feeType}
            onChange={(event) => {
              const feeType = event.target.value as ChargeType
              onChange({
                ...fee,
                feeType,
                name:
                  feeType === "custom"
                    ? fee.name
                    : defaultFeeName(feeType),
                recurrence:
                  feeType === "tuition" ? fee.recurrence : fee.recurrence,
              })
            }}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            {Object.entries(FEE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Amount</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={fee.amount}
            onChange={(event) =>
              onChange({ ...fee, amount: Number(event.target.value || 0) })
            }
          />
        </div>
      </div>

      {fee.feeType === "custom" ? (
        <div className="space-y-1.5">
          <Label className="text-xs">Name</Label>
          <Input
            value={fee.name}
            onChange={(event) =>
              onChange({ ...fee, name: event.target.value })
            }
            placeholder="Before Care, Lunch, Books…"
          />
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
        <div className="space-y-1.5">
          <Label className="text-xs">Recurrence</Label>
          <select
            value={fee.recurrence}
            onChange={(event) =>
              onChange({
                ...fee,
                recurrence: event.target.value as FeeRecurrence,
              })
            }
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            {Object.entries(FEE_RECURRENCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Billed to</Label>
          <select
            value={fee.billingScope}
            onChange={(event) =>
              onChange({
                ...fee,
                billingScope: event.target.value as FeeBillingScope,
              })
            }
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            {Object.entries(FEE_BILLING_SCOPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between gap-2 pb-1">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={fee.required}
              onCheckedChange={(checked) =>
                onChange({ ...fee, required: checked === true })
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
            aria-label={`Remove ${fee.name || "fee"}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function DiscountToggleRow({
  title,
  description,
  line,
  onChange,
  children,
}: {
  title: string
  description: string
  line: SimplePricingDiscountLine
  onChange: (next: SimplePricingDiscountLine) => void
  children?: React.ReactNode
}) {
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Switch
          checked={line.enabled}
          onCheckedChange={(checked) =>
            onChange({ ...line, enabled: checked })
          }
        />
      </div>
      {line.enabled ? (
        <div className="grid gap-3 sm:grid-cols-2">{children}</div>
      ) : null}
    </div>
  )
}

export function OfferingPricingEditorProvider({
  programId,
  offering,
  workspaceData,
  registrationOptions,
  onBeforeSave,
  saveHandlerRef,
  children,
}: {
  programId: string
  offering: ProgramOffering
  workspaceData: OfferingWorkspaceData
  registrationOptions: ProgramRegistrationOption[]
  onBeforeSave?: () => Promise<boolean>
  saveHandlerRef?: React.MutableRefObject<(() => Promise<boolean>) | null>
  children: React.ReactNode
}) {
  const router = useRouter()
  const feePlanStateRef = React.useRef<FeePlanEditorState>(
    buildInitialFeePlanState(offering, workspaceData, registrationOptions)
  )

  const [pricing, setPricing] = React.useState<SimpleOfferingPricing>(() =>
    parseSimplePricingFromWorkspace(
      workspaceData.feePlans,
      workspaceData.feePlanComponents,
      workspaceData.feePlanDiscountRules
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
          component.billing_scope,
          component.pricing_model,
        ]),
        discounts: workspaceData.feePlanDiscountRules.map((rule) => [
          rule.id,
          rule.rule_type,
          rule.amount,
          rule.is_active,
          rule.conditions,
        ]),
      }),
    [
      workspaceData.feePlanComponents,
      workspaceData.feePlanDiscountRules,
      workspaceData.feePlans,
    ]
  )

  React.useEffect(() => {
    const nextPricing = parseSimplePricingFromWorkspace(
      workspaceData.feePlans,
      workspaceData.feePlanComponents,
      workspaceData.feePlanDiscountRules
    )
    setPricing(nextPricing)
    feePlanStateRef.current = buildInitialFeePlanState(
      offering,
      workspaceData,
      registrationOptions
    )
  }, [offering.id, workspacePricingSignature])

  const requiredTotal = summarizeRequiredCharges(pricing.fees)
  const billingMonths = countOfferingBillingMonths(
    offering.start_date,
    offering.end_date
  )
  const billingBundle = workspaceData.billingSchedule.bundle
  const billingMigrationRequired = workspaceData.billingSchedule.migrationRequired
  const showBillingSchedule =
    pricing.paymentStructure === "monthly" ||
    pricing.paymentStructure === "installments" ||
    pricing.fees.some((fee) => fee.recurrence === "monthly")

  function updatePricing(
    updater: (current: SimpleOfferingPricing) => SimpleOfferingPricing
  ) {
    setPricing((current) => {
      const next = updater(current)
      const hasMonthly = next.fees.some((fee) => fee.recurrence === "monthly")
      const normalized: SimpleOfferingPricing = {
        ...next,
        paymentStructure:
          next.paymentStructure === "installments"
            ? "installments"
            : hasMonthly
              ? "monthly"
              : "one_time",
        paymentDueDay: hasMonthly
          ? next.paymentDueDay ?? 1
          : next.paymentDueDay,
      }
      feePlanStateRef.current = buildFeePlanStateFromSimplePricing(
        normalized,
        offering.name,
        feePlanStateRef.current
      )
      return normalized
    })
    setSuccess(false)
  }

  async function handleSave(): Promise<boolean> {
    setIsSaving(true)
    setError(null)
    setSuccess(false)

    try {
      if (onBeforeSave) {
        const ok = await onBeforeSave()
        if (!ok) {
          return false
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
      return true
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to save pricing."
      )
      return false
    } finally {
      setIsSaving(false)
    }
  }

  React.useEffect(() => {
    if (!saveHandlerRef) return
    saveHandlerRef.current = () => handleSave()
    return () => {
      saveHandlerRef.current = null
    }
  })

  const value = React.useMemo<OfferingPricingEditorContextValue>(
    () => ({
      offering,
      programId,
      pricing,
      updatePricing,
      requiredTotal,
      billingMonths,
      discountTags: workspaceData.discountTags ?? [],
      billingBundle,
      billingMigrationRequired,
      showBillingSchedule,
      isSaving,
      error,
      success,
      handleSave,
    }),
    [
      offering,
      programId,
      pricing,
      requiredTotal,
      billingMonths,
      workspaceData.discountTags,
      billingBundle,
      billingMigrationRequired,
      showBillingSchedule,
      isSaving,
      error,
      success,
    ]
  )

  return (
    <OfferingPricingEditorContext.Provider value={value}>
      {children}
    </OfferingPricingEditorContext.Provider>
  )
}

export function OfferingPricingBillingSetupSection() {
  const { pricing, updatePricing, billingMonths, offering } =
    useOfferingPricingEditor()
  const hasMonthly = pricing.fees.some((fee) => fee.recurrence === "monthly")

  return (
    <EditSectionCard title="Billing" plain>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Duration</Label>
          <div className="flex min-h-9 items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
            {offering.start_date && offering.end_date
              ? `${billingMonths} month${billingMonths === 1 ? "" : "s"} (from start/end dates)`
              : "Set start and end dates in General to compute duration"}
          </div>
        </div>
        {hasMonthly ? (
          <div className="space-y-1.5">
            <Label htmlFor="payment-due-day">Billing day (1–28)</Label>
            <Input
              id="payment-due-day"
              type="number"
              min="1"
              max="28"
              className="max-w-[140px]"
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
        ) : (
          <p className="text-xs text-muted-foreground">
            Billing day appears when any fee is set to Monthly.
          </p>
        )}
      </div>
    </EditSectionCard>
  )
}

/** Unified fees list (replaces Charges + Optional Add-Ons). */
export function OfferingPricingChargesSection() {
  const { pricing, updatePricing } = useOfferingPricingEditor()

  return (
    <EditSectionCard plain>
      <div className="space-y-3">
        {pricing.fees.map((fee) => (
          <FeeRow
            key={fee.clientId}
            fee={fee}
            onChange={(next) =>
              updatePricing((current) => ({
                ...current,
                fees: current.fees.map((item) =>
                  item.clientId === fee.clientId ? next : item
                ),
              }))
            }
            onRemove={() =>
              updatePricing((current) => ({
                ...current,
                fees: current.fees.filter(
                  (item) => item.clientId !== fee.clientId
                ),
              }))
            }
          />
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            updatePricing((current) => ({
              ...current,
              fees: [...current.fees, createDefaultFee("tuition")],
            }))
          }
        >
          <Plus className="mr-1 h-4 w-4" />
          Add fee
        </Button>
      </div>
    </EditSectionCard>
  )
}

/** @deprecated Add-ons merged into OfferingPricingChargesSection */
export function OfferingPricingAddonsSection() {
  return null
}

export function OfferingPricingDiscountsSection() {
  const { pricing, updatePricing, discountTags } = useOfferingPricingEditor()

  function updateDiscount<K extends keyof SimplePricingDiscounts>(
    key: K,
    next: SimplePricingDiscountLine
  ) {
    updatePricing((current) => ({
      ...current,
      discounts: { ...current.discounts, [key]: next },
    }))
  }

  return (
    <EditSectionCard title="Discounts" plain>
      <div className="space-y-3">
        <DiscountToggleRow
          title="Early bird"
          description="Percent off tuition when paid by the date below."
          line={pricing.discounts.earlyBird}
          onChange={(next) => updateDiscount("earlyBird", next)}
        >
          <div className="space-y-1.5">
            <Label className="text-xs">Pay by</Label>
            <Input
              type="date"
              value={pricing.discounts.earlyBird.endsBefore || ""}
              onChange={(event) =>
                updateDiscount("earlyBird", {
                  ...pricing.discounts.earlyBird,
                  endsBefore: event.target.value,
                })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Percent off tuition</Label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={pricing.discounts.earlyBird.percent}
              onChange={(event) =>
                updateDiscount("earlyBird", {
                  ...pricing.discounts.earlyBird,
                  percent: Number(event.target.value || 0),
                })
              }
            />
          </div>
        </DiscountToggleRow>

        <DiscountToggleRow
          title="Pay in full"
          description="Percent off when the balance is paid up front."
          line={pricing.discounts.fullPayment}
          onChange={(next) => updateDiscount("fullPayment", next)}
        >
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Percent off</Label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              className="max-w-[140px]"
              value={pricing.discounts.fullPayment.percent}
              onChange={(event) =>
                updateDiscount("fullPayment", {
                  ...pricing.discounts.fullPayment,
                  percent: Number(event.target.value || 0),
                })
              }
            />
          </div>
        </DiscountToggleRow>

        <DiscountToggleRow
          title="Sibling"
          description="When another sibling is already enrolled in this program."
          line={pricing.discounts.sibling}
          onChange={(next) => updateDiscount("sibling", next)}
        >
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Percent off</Label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              className="max-w-[140px]"
              value={pricing.discounts.sibling.percent}
              onChange={(event) =>
                updateDiscount("sibling", {
                  ...pricing.discounts.sibling,
                  percent: Number(event.target.value || 0),
                })
              }
            />
          </div>
        </DiscountToggleRow>

        <DiscountToggleRow
          title="Member"
          description="Contacts with the selected member discount tag."
          line={pricing.discounts.member}
          onChange={(next) => updateDiscount("member", next)}
        >
          <div className="space-y-1.5">
            <Label className="text-xs">Discount tag</Label>
            <select
              value={pricing.discounts.member.discountTagId || ""}
              onChange={(event) =>
                updateDiscount("member", {
                  ...pricing.discounts.member,
                  discountTagId: event.target.value || null,
                })
              }
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Select tag…</option>
              {discountTags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Percent off</Label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={pricing.discounts.member.percent}
              onChange={(event) =>
                updateDiscount("member", {
                  ...pricing.discounts.member,
                  percent: Number(event.target.value || 0),
                })
              }
            />
          </div>
        </DiscountToggleRow>

        <DiscountToggleRow
          title="Staff"
          description="Contacts with the selected staff discount tag."
          line={pricing.discounts.staff}
          onChange={(next) => updateDiscount("staff", next)}
        >
          <div className="space-y-1.5">
            <Label className="text-xs">Discount tag</Label>
            <select
              value={pricing.discounts.staff.discountTagId || ""}
              onChange={(event) =>
                updateDiscount("staff", {
                  ...pricing.discounts.staff,
                  discountTagId: event.target.value || null,
                })
              }
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Select tag…</option>
              {discountTags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Percent off</Label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={pricing.discounts.staff.percent}
              onChange={(event) =>
                updateDiscount("staff", {
                  ...pricing.discounts.staff,
                  percent: Number(event.target.value || 0),
                })
              }
            />
          </div>
        </DiscountToggleRow>

        {discountTags.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Create Member / Staff tags under Workforce → Settings → Discount
            tags, then assign them on contacts.
          </p>
        ) : null}
      </div>
    </EditSectionCard>
  )
}

export function OfferingPaymentStructureFields({
  layout = "vertical",
}: {
  layout?: "horizontal" | "vertical"
}) {
  const { pricing, updatePricing } = useOfferingPricingEditor()

  return (
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
        className={cn(
          "grid gap-3",
          layout === "horizontal" ? "sm:grid-cols-3" : "grid-cols-1"
        )}
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
                installmentCount: Math.max(2, Number(event.target.value || 2)),
              }))
            }
          />
        </div>
      ) : null}

      {pricing.paymentStructure === "monthly" ? (
        <div className="max-w-xs space-y-1.5">
          <Label htmlFor="payment-due-day-legacy">Payment due day (1–28)</Label>
          <Input
            id="payment-due-day-legacy"
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
  )
}

export function OfferingPaymentStructureSection({
  layout = "vertical",
}: {
  layout?: "horizontal" | "vertical"
}) {
  return (
    <EditSectionCard title="Payment Structure" plain>
      <OfferingPaymentStructureFields layout={layout} />
    </EditSectionCard>
  )
}

export function OfferingPricingBillingScheduleSection() {
  const {
    programId,
    billingBundle,
    billingMigrationRequired,
    showBillingSchedule,
  } = useOfferingPricingEditor()

  if (!showBillingSchedule) {
    return null
  }

  return (
    <EditSectionCard title="Billing Schedule" plain>
      {billingMigrationRequired ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-950">
          <p className="font-medium">Database migration required</p>
          <p className="mt-2">{BILLING_MIGRATION_MESSAGE}</p>
        </div>
      ) : !billingBundle ? (
        <p className="text-sm text-muted-foreground">
          Set program start and end dates to generate the billing calendar.
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
  )
}

export function OfferingPricingSaveFooter({
  showSaveButton = true,
}: {
  showSaveButton?: boolean
}) {
  const { offering, isSaving, error, success, handleSave } =
    useOfferingPricingEditor()

  if (!showSaveButton) {
    return null
  }

  return (
    <>
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
    </>
  )
}

export function OfferingPricingEditorSections({
  showCharges = true,
  showAddons: _showAddons = false,
  showPaymentStructure = false,
  showBillingSchedule = true,
  showDiscounts = true,
  showBillingSetup = true,
  showTitle = true,
  showSaveButton = true,
  paymentStructureLayout = "vertical",
}: {
  showCharges?: boolean
  showAddons?: boolean
  showPaymentStructure?: boolean
  showBillingSchedule?: boolean
  showDiscounts?: boolean
  showBillingSetup?: boolean
  showTitle?: boolean
  showSaveButton?: boolean
  paymentStructureLayout?: "horizontal" | "vertical"
}) {
  const { requiredTotal } = useOfferingPricingEditor()

  return (
    <div className="space-y-5">
      {showTitle ? (
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Pricing</h3>
          {requiredTotal > 0 ? (
            <p className="text-sm font-medium">
              Required fees total: {formatPricingCurrency(requiredTotal)}
            </p>
          ) : null}
        </div>
      ) : null}

      {showBillingSetup ? <OfferingPricingBillingSetupSection /> : null}
      {showCharges ? <OfferingPricingChargesSection /> : null}
      {showDiscounts ? <OfferingPricingDiscountsSection /> : null}
      {showPaymentStructure ? (
        <OfferingPaymentStructureSection layout={paymentStructureLayout} />
      ) : null}
      {showBillingSchedule ? <OfferingPricingBillingScheduleSection /> : null}
      <OfferingPricingSaveFooter showSaveButton={showSaveButton} />
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
  showCharges = true,
  showAddons = false,
  showPaymentStructure = false,
  showBillingSchedule = true,
  showTitle = true,
  paymentStructureLayout = "vertical",
}: {
  programId: string
  offering: ProgramOffering
  workspaceData: OfferingWorkspaceData
  registrationOptions: ProgramRegistrationOption[]
  showSaveButton?: boolean
  onBeforeSave?: () => Promise<boolean>
  showCharges?: boolean
  showAddons?: boolean
  showPaymentStructure?: boolean
  showBillingSchedule?: boolean
  showTitle?: boolean
  paymentStructureLayout?: "horizontal" | "vertical"
}) {
  return (
    <OfferingPricingEditorProvider
      programId={programId}
      offering={offering}
      workspaceData={workspaceData}
      registrationOptions={registrationOptions}
      onBeforeSave={onBeforeSave}
    >
      <OfferingPricingEditorSections
        showCharges={showCharges}
        showAddons={showAddons}
        showPaymentStructure={showPaymentStructure}
        showBillingSchedule={showBillingSchedule}
        showTitle={showTitle}
        showSaveButton={showSaveButton}
        paymentStructureLayout={paymentStructureLayout}
      />
    </OfferingPricingEditorProvider>
  )
}
