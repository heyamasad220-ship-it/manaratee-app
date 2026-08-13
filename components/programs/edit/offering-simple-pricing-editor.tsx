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
  countOfferingBillingMonths,
  createDefaultFee,
  formatPricingCurrency,
  parseSimplePricingFromWorkspace,
  summarizeRequiredCharges,
} from "@/lib/programs/offering-pricing-mapper"
import {
  DISCOUNT_STATUS_LABELS,
  DISCOUNT_VALUE_TYPE_LABELS,
  FEE_BILLING_SCOPE_LABELS,
  FEE_RECURRENCE_LABELS,
  FEE_TYPE_LABELS,
  OFFERING_DISCOUNT_NAME_LABELS,
  PAYMENT_STRUCTURE_LABELS,
  DEFAULT_PAYMENT_OPTIONS,
  createDefaultDiscount,
  defaultFeeName,
  hasMonthlyFeeRecurrence,
  resolvePaymentOptionsBaseAmount,
  type ChargeType,
  type FeeBillingScope,
  type FeeRecurrence,
  type OfferingDiscount,
  type OfferingDiscountName,
  type OfferingFee,
  type PaymentStructure,
  type SimpleDiscountStatus,
  type SimpleDiscountValueType,
  type SimpleOfferingPricing,
} from "@/lib/programs/offering-pricing-simple-types"
import { BILLING_MIGRATION_MESSAGE } from "@/lib/programs/program-billing-schema"
import { billingDayFromStartDate } from "@/lib/programs/program-billing-utils"
import { saveOfferingPricing } from "@/lib/programs/offering-workspace-actions"
import type { OfferingWorkspaceData } from "@/lib/programs/offering-workspace-types"
import type { ProgramOffering } from "@/lib/programs/program-offering-types"
import type { ProgramRegistrationOption } from "@/lib/programs/program-registration-option-types"
import { allowsAcademicBillingSchedules } from "@/lib/programs/program-kind-policy"
import { normalizeProgramKind } from "@/lib/programs/program-kind"
import { cn } from "@/lib/utils"

type DiscountTagOption = { id: string; name: string }

type OfferingPricingEditorContextValue = {
  offering: ProgramOffering
  programId: string
  programKind: string
  allowsMonthlyTuition: boolean
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
  allowsMonthlyTuition,
}: {
  fee: OfferingFee
  onChange: (next: OfferingFee) => void
  onRemove: () => void
  allowsMonthlyTuition: boolean
}) {
  const recurrenceOptions = Object.entries(FEE_RECURRENCE_LABELS).filter(
    ([value]) => allowsMonthlyTuition || value !== "monthly"
  )

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
        <div className="space-y-1.5">
          <Label className="text-xs">Name</Label>
          <select
            value={fee.feeType}
            onChange={(event) => {
              const feeType = event.target.value as ChargeType
              onChange({
                ...fee,
                feeType,
                name:
                  feeType === "custom" ? fee.name : defaultFeeName(feeType),
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
            className="h-9"
            value={fee.amount}
            onChange={(event) =>
              onChange({ ...fee, amount: Number(event.target.value || 0) })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Type</Label>
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
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1.5">
          <Label className="text-xs">Recurrence</Label>
          <Label className="text-xs">Required</Label>
          <select
            id={`fee-recurrence-${fee.clientId}`}
            value={
              !allowsMonthlyTuition && fee.recurrence === "monthly"
                ? "one_time"
                : fee.recurrence
            }
            onChange={(event) =>
              onChange({
                ...fee,
                recurrence: event.target.value as FeeRecurrence,
              })
            }
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            {recurrenceOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <div className="flex h-9 items-center justify-center">
            <Checkbox
              checked={fee.required}
              onCheckedChange={(checked) =>
                onChange({ ...fee, required: checked === true })
              }
              aria-label="Required"
            />
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="mt-6 h-9 w-9 shrink-0 text-destructive hover:text-destructive"
          onClick={onRemove}
          aria-label={`Remove ${fee.name || "fee"}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {fee.feeType === "custom" ? (
        <div className="space-y-1.5 sm:max-w-sm">
          <Label className="text-xs">Name</Label>
          <Input
            className="h-9"
            value={fee.name}
            onChange={(event) =>
              onChange({ ...fee, name: event.target.value })
            }
            placeholder="Before Care, Lunch, Books…"
          />
        </div>
      ) : null}
    </div>
  )
}

function DiscountRow({
  discount,
  onChange,
  onRemove,
}: {
  discount: OfferingDiscount
  onChange: (next: OfferingDiscount) => void
  onRemove: () => void
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_auto]">
        <div className="space-y-1.5">
          <Label className="text-xs">Name</Label>
          <select
            value={discount.name}
            onChange={(event) => {
              const name = event.target.value as OfferingDiscountName
              onChange({
                ...discount,
                name,
                customLabel:
                  name === "custom" ? discount.customLabel || "" : undefined,
                value:
                  discount.value ||
                  (name === "full_payment"
                    ? 5
                    : name === "sibling" || name === "early_bird"
                      ? 10
                      : 0),
              })
            }}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            {Object.entries(OFFERING_DISCOUNT_NAME_LABELS).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              )
            )}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Type</Label>
          <select
            value={discount.valueType}
            onChange={(event) =>
              onChange({
                ...discount,
                valueType: event.target.value as SimpleDiscountValueType,
              })
            }
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            {Object.entries(DISCOUNT_VALUE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">
            {discount.valueType === "percent" ? "Percent" : "Amount"}
          </Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            max={discount.valueType === "percent" ? 100 : undefined}
            className="h-9"
            value={discount.value}
            onChange={(event) =>
              onChange({
                ...discount,
                value: Number(event.target.value || 0),
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Status</Label>
          <select
            value={discount.status}
            onChange={(event) =>
              onChange({
                ...discount,
                status: event.target.value as SimpleDiscountStatus,
              })
            }
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            {Object.entries(DISCOUNT_STATUS_LABELS).map(([value, label]) => (
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
          className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
          onClick={onRemove}
          aria-label="Remove discount"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {discount.name === "custom" ? (
        <div className="space-y-1.5 sm:max-w-sm">
          <Label className="text-xs">Custom name</Label>
          <Input
            className="h-9"
            value={discount.customLabel || ""}
            onChange={(event) =>
              onChange({ ...discount, customLabel: event.target.value })
            }
            placeholder="Summer promo, Referral…"
          />
        </div>
      ) : null}

      {discount.name === "early_bird" ? (
        <div className="space-y-1.5 sm:max-w-xs">
          <Label className="text-xs">Pay by</Label>
          <Input
            type="date"
            className="h-9"
            value={discount.endsBefore || ""}
            onChange={(event) =>
              onChange({ ...discount, endsBefore: event.target.value })
            }
          />
        </div>
      ) : null}
    </div>
  )
}

export function OfferingPricingEditorProvider({
  programId,
  offering,
  workspaceData,
  registrationOptions,
  programKind: programKindProp,
  onBeforeSave,
  saveHandlerRef,
  children,
}: {
  programId: string
  offering: ProgramOffering
  workspaceData: OfferingWorkspaceData
  registrationOptions: ProgramRegistrationOption[]
  programKind?: string | null
  onBeforeSave?: () => Promise<boolean>
  saveHandlerRef?: React.MutableRefObject<(() => Promise<boolean>) | null>
  children: React.ReactNode
}) {
  const router = useRouter()
  const programKind = normalizeProgramKind(programKindProp)
  const allowsMonthlyTuition = allowsAcademicBillingSchedules(programKind)
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
  const billingBundle = workspaceData.billingSchedule.bundle
  const billingMigrationRequired = workspaceData.billingSchedule.migrationRequired
  const billingMonths = React.useMemo(() => {
    const periods = billingBundle?.billing_periods
    if (periods && periods.length > 0) {
      return periods.filter((period) => period.period_status === "active").length
    }
    return countOfferingBillingMonths(offering.start_date, offering.end_date)
  }, [
    billingBundle?.billing_periods,
    offering.start_date,
    offering.end_date,
  ])
  const showBillingSchedule =
    allowsMonthlyTuition &&
    (pricing.paymentStructure === "monthly" ||
      pricing.paymentStructure === "installments" ||
      pricing.fees.some((fee) => fee.recurrence === "monthly"))

  function updatePricing(
    updater: (current: SimpleOfferingPricing) => SimpleOfferingPricing
  ) {
    setPricing((current) => {
      const next = updater(current)
      const hasMonthly =
        allowsMonthlyTuition &&
        next.fees.some((fee) => fee.recurrence === "monthly")
      const normalizedFees = allowsMonthlyTuition
        ? next.fees
        : next.fees.map((fee) =>
            fee.recurrence === "monthly"
              ? { ...fee, recurrence: "one_time" as const }
              : fee
          )
      const normalized: SimpleOfferingPricing = {
        ...next,
        fees: normalizedFees,
        paymentOptions: next.paymentOptions ?? { ...DEFAULT_PAYMENT_OPTIONS },
        paymentStructure:
          next.paymentStructure === "installments"
            ? "installments"
            : hasMonthly
              ? "monthly"
              : "one_time",
        paymentDueDay: hasMonthly
          ? billingDayFromStartDate(offering.start_date) ??
            next.paymentDueDay ??
            1
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
      programKind,
      allowsMonthlyTuition,
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
      programKind,
      allowsMonthlyTuition,
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
  return null
}

/** Unified fees list (replaces Charges + Optional Add-Ons). */
export function OfferingPricingChargesSection() {
  const { pricing, updatePricing, allowsMonthlyTuition } =
    useOfferingPricingEditor()

  return (
    <EditSectionCard title="Fees" plain>
      <div className="space-y-3">
        {pricing.fees.map((fee) => (
          <FeeRow
            key={fee.clientId}
            fee={fee}
            allowsMonthlyTuition={allowsMonthlyTuition}
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

/** Shown when any fee uses monthly recurrence. */
export function OfferingPricingPaymentOptionsSection() {
  const { pricing, updatePricing } = useOfferingPricingEditor()

  if (!hasMonthlyFeeRecurrence(pricing.fees)) {
    return null
  }

  const baseAmount = resolvePaymentOptionsBaseAmount(pricing.fees)
  const semesterAmount = baseAmount / 2
  const options = pricing.paymentOptions ?? DEFAULT_PAYMENT_OPTIONS

  const rows = [
    {
      key: "payInFull" as const,
      label: "Pay in Full",
      schedule: `${formatPricingCurrency(baseAmount)} at registration`,
      checked: options.payInFull,
    },
    {
      key: "twoSemesterPayments" as const,
      label: "2 Semester Payments",
      schedule: `${formatPricingCurrency(semesterAmount)} × 2`,
      checked: options.twoSemesterPayments,
    },
  ]

  return (
    <EditSectionCard title="Payment Options" plain>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Choose which payment methods are available for monthly fees.
        </p>
        <div className="overflow-hidden rounded-md border">
          <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Payment Option</span>
            <span>Amount / Schedule</span>
          </div>
          {rows.map((row) => (
            <label
              key={row.key}
              className="grid cursor-pointer grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-center gap-3 border-b px-3 py-3 last:border-b-0"
            >
              <span className="flex items-center gap-3 text-sm font-medium">
                <Checkbox
                  checked={row.checked}
                  onCheckedChange={(checked) =>
                    updatePricing((current) => ({
                      ...current,
                      paymentOptions: {
                        ...(current.paymentOptions ?? DEFAULT_PAYMENT_OPTIONS),
                        [row.key]: checked === true,
                      },
                    }))
                  }
                />
                {row.label}
              </span>
              <span className="text-sm text-muted-foreground">{row.schedule}</span>
            </label>
          ))}
        </div>
      </div>
    </EditSectionCard>
  )
}

/** @deprecated Add-ons merged into OfferingPricingChargesSection */
export function OfferingPricingAddonsSection() {
  return null
}

export function OfferingPricingDiscountsSection() {
  const { pricing, updatePricing } = useOfferingPricingEditor()

  return (
    <EditSectionCard title="Discounts" plain>
      <div className="space-y-3">
        {pricing.discounts.map((discount) => (
          <DiscountRow
            key={discount.clientId}
            discount={discount}
            onChange={(next) =>
              updatePricing((current) => ({
                ...current,
                discounts: current.discounts.map((item) =>
                  item.clientId === discount.clientId ? next : item
                ),
              }))
            }
            onRemove={() =>
              updatePricing((current) => ({
                ...current,
                discounts: current.discounts.filter(
                  (item) => item.clientId !== discount.clientId
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
              discounts: [...current.discounts, createDefaultDiscount()],
            }))
          }
        >
          <Plus className="mr-1 h-4 w-4" />
          Add discount
        </Button>
      </div>
    </EditSectionCard>
  )
}

export function OfferingPaymentStructureFields({
  layout = "vertical",
}: {
  layout?: "horizontal" | "vertical"
}) {
  const { pricing, updatePricing, allowsMonthlyTuition } =
    useOfferingPricingEditor()
  const structureOptions = Object.entries(PAYMENT_STRUCTURE_LABELS).filter(
    ([value]) => allowsMonthlyTuition || value !== "monthly"
  )

  return (
    <div className="space-y-4">
      <RadioGroup
        value={
          !allowsMonthlyTuition && pricing.paymentStructure === "monthly"
            ? "one_time"
            : pricing.paymentStructure
        }
        onValueChange={(value) =>
          updatePricing((current) => ({
            ...current,
            paymentStructure: value as PaymentStructure,
            installmentCount:
              value === "installments" ? current.installmentCount ?? 2 : null,
          }))
        }
        className={cn(
          "grid gap-3",
          layout === "horizontal" ? "sm:grid-cols-3" : "grid-cols-1"
        )}
      >
        {structureOptions.map(([value, label]) => (
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
  showBillingSetup: _showBillingSetup = false,
  showTitle = true,
  showSaveButton = true,
  paymentStructureLayout = "vertical",
}: {
  showCharges?: boolean
  showAddons?: boolean
  showPaymentStructure?: boolean
  showBillingSchedule?: boolean
  showDiscounts?: boolean
  /** @deprecated Duration / billing day live under Billing Schedule. */
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

      {showCharges ? <OfferingPricingChargesSection /> : null}
      <OfferingPricingPaymentOptionsSection />
      {showBillingSchedule ? <OfferingPricingBillingScheduleSection /> : null}
      {showDiscounts ? <OfferingPricingDiscountsSection /> : null}
      {showPaymentStructure ? (
        <OfferingPaymentStructureSection layout={paymentStructureLayout} />
      ) : null}
      <OfferingPricingSaveFooter showSaveButton={showSaveButton} />
    </div>
  )
}

export function OfferingSimplePricingEditor({
  programId,
  offering,
  workspaceData,
  registrationOptions,
  programKind = null,
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
  programKind?: string | null
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
      programKind={programKind}
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
