import { percentOfCents } from "@/lib/billing/money"
import { PRODUCT_MODULE_SLUGS } from "@/lib/modules/module-catalog"

export type PricedProductModule = {
  slug: string
  name: string
  description: string | null
  monthlyPriceCents: number
  isActive: boolean
}

export type ModuleDiscountRule = {
  moduleCount: number
  discountPercent: number
  isActive: boolean
}

export type SubscriptionQuoteInput = {
  selectedSlugs: Iterable<string>
  productModules: PricedProductModule[]
  discountRules: ModuleDiscountRule[]
  customMonthlyCents?: number | null
  isPriceLocked?: boolean
  lockedMonthlyCents?: number | null
}

export type SubscriptionQuoteLine = {
  slug: string
  name: string
  monthlyPriceCents: number
}

export type SubscriptionQuote = {
  selectedSlugs: string[]
  lines: SubscriptionQuoteLine[]
  moduleCount: number
  moduleSubtotalCents: number
  discountPercent: number
  discountAmountCents: number
  calculatedMonthlyCents: number
  customMonthlyCents: number | null
  billedMonthlyCents: number
  isPriceLocked: boolean
  usingCustomPrice: boolean
}

export function discountPercentForModuleCount(
  moduleCount: number,
  rules: ModuleDiscountRule[]
): number {
  if (moduleCount <= 0) return 0
  const match = rules.find(
    (rule) => rule.isActive && rule.moduleCount === moduleCount
  )
  if (!match) return 0
  return Math.max(0, Math.min(100, Math.trunc(match.discountPercent)))
}

export function calculateModuleSubscriptionQuote(
  input: SubscriptionQuoteInput
): SubscriptionQuote {
  const selected = new Set(
    Array.from(input.selectedSlugs).filter((slug) =>
      (PRODUCT_MODULE_SLUGS as readonly string[]).includes(slug)
    )
  )

  const lines: SubscriptionQuoteLine[] = []
  for (const slug of PRODUCT_MODULE_SLUGS) {
    if (!selected.has(slug)) continue
    const module = input.productModules.find((item) => item.slug === slug)
    if (!module) continue
    lines.push({
      slug,
      name: module.name,
      monthlyPriceCents: Math.max(0, Math.trunc(module.monthlyPriceCents || 0)),
    })
  }

  const moduleCount = lines.length
  let moduleSubtotalCents = 0
  for (const line of lines) {
    moduleSubtotalCents += line.monthlyPriceCents
  }

  const discountPercent = discountPercentForModuleCount(
    moduleCount,
    input.discountRules
  )
  const discountAmountCents = percentOfCents(moduleSubtotalCents, discountPercent)
  const calculatedMonthlyCents = moduleSubtotalCents - discountAmountCents

  const customMonthlyCents =
    input.customMonthlyCents == null
      ? null
      : Math.max(0, Math.trunc(input.customMonthlyCents))

  const lockedMonthlyCents =
    input.lockedMonthlyCents == null
      ? null
      : Math.max(0, Math.trunc(input.lockedMonthlyCents))

  const usingCustomPrice = customMonthlyCents != null
  const isPriceLocked = Boolean(input.isPriceLocked)

  let billedMonthlyCents = calculatedMonthlyCents
  if (usingCustomPrice && customMonthlyCents != null) {
    billedMonthlyCents = customMonthlyCents
  } else if (isPriceLocked && lockedMonthlyCents != null) {
    billedMonthlyCents = lockedMonthlyCents
  }

  return {
    selectedSlugs: lines.map((line) => line.slug),
    lines,
    moduleCount,
    moduleSubtotalCents,
    discountPercent,
    discountAmountCents,
    calculatedMonthlyCents,
    customMonthlyCents,
    billedMonthlyCents,
    isPriceLocked,
    usingCustomPrice,
  }
}

export function quoteDifferenceCents(
  currentBilledCents: number,
  nextBilledCents: number
) {
  return Math.trunc(nextBilledCents) - Math.trunc(currentBilledCents)
}
