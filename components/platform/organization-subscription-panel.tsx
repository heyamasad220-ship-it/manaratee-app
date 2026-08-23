"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { formatCentsAsUsd, parseUsdToCents } from "@/lib/billing/money"
import { calculateModuleSubscriptionQuote } from "@/lib/billing/module-subscription-pricing"
import { productModuleIncludesCaption } from "@/lib/modules/staff-module-labels"
import { cn } from "@/lib/utils"

type CatalogModule = {
  id: string
  slug: string
  name: string
  description: string | null
  monthlyPriceCents: number
  isActive: boolean
}

type DiscountRule = {
  moduleCount: number
  discountPercent: number
  isActive: boolean
}

type Snapshot = {
  billedMonthlyCents: number
  calculatedMonthlyCents: number
  customMonthlyCents: number | null
  isPriceLocked: boolean
  selectedProductSlugs: string[]
  nextBillingDate: string | null
  billingStatus?: string
}

type BundleOption = {
  slug: string
  name: string
  description: string
  moduleSlugs: string[]
}

type OrganizationSubscriptionPanelProps = {
  organizationId: string
  onSaved?: (billedMonthlyCents: number) => void
}

export function OrganizationSubscriptionPanel({
  organizationId,
  onSaved,
}: OrganizationSubscriptionPanelProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [catalog, setCatalog] = useState<CatalogModule[]>([])
  const [discountRules, setDiscountRules] = useState<DiscountRule[]>([])
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([])
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [customPriceInput, setCustomPriceInput] = useState("")
  const [useCustomPrice, setUseCustomPrice] = useState(false)
  const [isPriceLocked, setIsPriceLocked] = useState(false)
  const [bundles, setBundles] = useState<BundleOption[]>([])
  const [activeBundleSlug, setActiveBundleSlug] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/platform/organizations/${organizationId}/subscription`
      )
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Failed to load subscription.")
      const nextCatalog: CatalogModule[] = result.catalog || []
      const nextSelected: string[] = result.selectedProductSlugs || []
      setCatalog(nextCatalog)
      setDiscountRules(result.discountRules || [])
      setSelectedSlugs(nextSelected)
      setSnapshot(result.snapshot)
      setIsPriceLocked(Boolean(result.snapshot?.isPriceLocked))
      const custom = result.snapshot?.customMonthlyCents
      setUseCustomPrice(custom != null)
      setCustomPriceInput(custom == null ? "" : (custom / 100).toFixed(2))
      setBundles(result.access?.bundles || [])
      setActiveBundleSlug(result.access?.bundleSlug || null)
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to load subscription.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  const quote = useMemo(() => {
    const customCents = useCustomPrice ? parseUsdToCents(customPriceInput) : null
    return calculateModuleSubscriptionQuote({
      selectedSlugs,
      productModules: catalog,
      discountRules,
      customMonthlyCents: useCustomPrice ? customCents : null,
      isPriceLocked,
      lockedMonthlyCents: snapshot?.billedMonthlyCents ?? null,
    })
  }, [
    selectedSlugs,
    catalog,
    discountRules,
    customPriceInput,
    useCustomPrice,
    isPriceLocked,
    snapshot?.billedMonthlyCents,
  ])

  const differenceCents = quote.billedMonthlyCents - (snapshot?.billedMonthlyCents ?? 0)

  function toggleSlug(slug: string, enabled: boolean, isActive: boolean, currentlySelected: boolean) {
    if (enabled && !isActive && !currentlySelected) return
    setSelectedSlugs((prev) => {
      const next = new Set(prev)
      if (enabled) next.add(slug)
      else next.delete(slug)
      return catalog.map((item) => item.slug).filter((item) => next.has(item))
    })
    setActiveBundleSlug(null)
  }

  async function save() {
    if (useCustomPrice && parseUsdToCents(customPriceInput) == null) {
      alert("Enter a valid custom monthly price, or turn custom pricing off.")
      return
    }
    setSaving(true)
    try {
      const response = await fetch(
        `/api/platform/organizations/${organizationId}/subscription`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selectedProductSlugs: selectedSlugs,
            customMonthlyCents: useCustomPrice ? parseUsdToCents(customPriceInput) : null,
            isPriceLocked,
            bundleSlug: activeBundleSlug,
          }),
        }
      )
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Failed to save subscription.")
      setSnapshot(result.snapshot)
      setSelectedSlugs(result.selectedProductSlugs || selectedSlugs)
      onSaved?.(result.snapshot?.billedMonthlyCents ?? quote.billedMonthlyCents)
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save subscription.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading subscription...</p>
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div>
            <h3 className="text-sm font-semibold">Subscription quote</h3>
            <p className="text-xs text-muted-foreground">
              The server recalculates the total on save. Custom and grandfathered prices do not
              change catalog module prices.
            </p>
          </div>
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current billed</span>
              <span>{formatCentsAsUsd(snapshot?.billedMonthlyCents ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCentsAsUsd(quote.moduleSubtotalCents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Discount ({quote.discountPercent}%)
              </span>
              <span>-{formatCentsAsUsd(quote.discountAmountCents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Calculated total</span>
              <span>{formatCentsAsUsd(quote.calculatedMonthlyCents)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>New monthly total</span>
              <span>{formatCentsAsUsd(quote.billedMonthlyCents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Difference</span>
              <span>
                {differenceCents >= 0 ? "+" : "−"}
                {formatCentsAsUsd(Math.abs(differenceCents))}
              </span>
            </div>
          </div>
          {snapshot?.isPriceLocked ? (
            <Badge variant="secondary" className="bg-amber-100 text-amber-800">
              Price locked / grandfathered
            </Badge>
          ) : null}
        </CardContent>
      </Card>

      {bundles.length > 0 ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div>
              <h3 className="text-sm font-semibold">Optional presets</h3>
              <p className="text-xs text-muted-foreground">
                Presets only pre-select product modules. They are not billed plans.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {bundles.map((bundle) => (
                <div
                  key={bundle.slug}
                  className={cn(
                    "rounded-lg border p-3",
                    activeBundleSlug === bundle.slug && "border-emerald-500 bg-emerald-50/40"
                  )}
                >
                  <p className="text-sm font-medium">{bundle.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{bundle.description}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() => {
                      setSelectedSlugs(bundle.moduleSlugs)
                      setActiveBundleSlug(bundle.slug)
                    }}
                  >
                    Use preset
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="space-y-3 p-4">
          <div>
            <h3 className="text-sm font-semibold">Product modules</h3>
            <p className="text-xs text-muted-foreground">
              Check the modules this organization should have. Implied capabilities stay free.
            </p>
          </div>
          <div className="space-y-2">
            {catalog.map((module) => {
              const checked = selectedSlugs.includes(module.slug)
              const blocked = !module.isActive && !checked
              return (
                <label
                  key={module.slug}
                  className={cn(
                    "flex items-start gap-3 rounded-md border px-3 py-2",
                    blocked && "opacity-60"
                  )}
                >
                  <Checkbox
                    checked={checked}
                    disabled={blocked}
                    onCheckedChange={(value) =>
                      toggleSlug(module.slug, value === true, module.isActive, checked)
                    }
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">{module.name}</p>
                      <p className="text-sm font-medium">
                        {formatCentsAsUsd(module.monthlyPriceCents)}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {module.description || productModuleIncludesCaption(module.slug) || ""}
                    </p>
                    {blocked ? (
                      <p className="text-xs text-amber-700">Inactive — cannot be newly selected.</p>
                    ) : null}
                  </div>
                </label>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Label htmlFor="custom-monthly">Custom monthly price</Label>
              <p className="text-xs text-muted-foreground">
                Optional override billed instead of the calculated total.
              </p>
            </div>
            <Switch checked={useCustomPrice} onCheckedChange={setUseCustomPrice} />
          </div>
          <Input
            id="custom-monthly"
            disabled={!useCustomPrice}
            value={customPriceInput}
            onChange={(event) => setCustomPriceInput(event.target.value)}
            placeholder="299.00"
          />
          <div className="flex items-start justify-between gap-3">
            <div>
              <Label>Keep billed amount locked</Label>
              <p className="text-xs text-muted-foreground">
                Leave on to preserve a grandfathered price unless a custom price is set.
              </p>
            </div>
            <Switch checked={isPriceLocked} onCheckedChange={setIsPriceLocked} />
          </div>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Saving..." : "Save subscription"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
