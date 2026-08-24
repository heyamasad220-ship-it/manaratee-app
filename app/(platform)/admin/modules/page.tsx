"use client"

import { useEffect, useState } from "react"
import { PlatformHeader } from "@/components/platform/platform-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Boxes,
  Calendar,
  GraduationCap,
  Heart,
  Pencil,
  Plus,
  Store,
  Ticket,
  Users,
} from "lucide-react"
import { formatCentsAsUsd, parseUsdToCents } from "@/lib/billing/money"
import { slugifyProductModuleSlug } from "@/lib/modules/module-catalog"
import { catalogCapabilityCheckboxItems } from "@/lib/modules/staff-module-labels"

type CatalogModule = {
  id: string
  slug: string
  name: string
  description: string | null
  monthlyPriceCents: number
  isActive: boolean
  includedCapabilitySlugs: string[]
}

type DiscountRule = {
  moduleCount: number
  discountPercent: number
  isActive: boolean
}

type CapabilityOption = {
  slug: string
  name: string
}

const moduleIcons: Record<string, React.ElementType> = {
  "event-management": Ticket,
  programs: GraduationCap,
  "vendor-hub": Store,
  bookings: Calendar,
  donations: Heart,
  membership: Users,
}

const defaultCapabilities = catalogCapabilityCheckboxItems()

export default function ModulesPage() {
  const [modules, setModules] = useState<CatalogModule[]>([])
  const [discountRules, setDiscountRules] = useState<DiscountRule[]>([])
  const [capabilities, setCapabilities] = useState<CapabilityOption[]>(defaultCapabilities)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingModule, setEditingModule] = useState<CatalogModule | null>(null)
  const [saving, setSaving] = useState(false)
  const [savingDiscounts, setSavingDiscounts] = useState(false)
  const [editName, setEditName] = useState("")
  const [editSlug, setEditSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [editDescription, setEditDescription] = useState("")
  const [editPrice, setEditPrice] = useState("")
  const [editCapabilitySlugs, setEditCapabilitySlugs] = useState<string[]>([])

  const isAdd = dialogOpen && !editingModule

  async function loadCatalog() {
    setLoading(true)
    try {
      const response = await fetch("/api/platform/modules")
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Failed to load modules.")
      setModules(result.modules || [])
      setDiscountRules(result.discountRules || [])
      if (Array.isArray(result.capabilities) && result.capabilities.length > 0) {
        setCapabilities(result.capabilities)
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to load modules.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCatalog()
  }, [])

  async function toggleActive(module: CatalogModule) {
    const next = !module.isActive
    setModules((current) =>
      current.map((item) => (item.id === module.id ? { ...item, isActive: next } : item))
    )
    const response = await fetch(`/api/platform/modules/${module.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: next }),
    })
    if (!response.ok) {
      setModules((current) =>
        current.map((item) =>
          item.id === module.id ? { ...item, isActive: module.isActive } : item
        )
      )
      const result = await response.json()
      alert(result.error || "Failed to update status.")
    }
  }

  function resetDialog(module?: CatalogModule | null) {
    setEditingModule(module ?? null)
    setEditName(module?.name || "")
    setEditSlug(module?.slug || "")
    setSlugTouched(Boolean(module))
    setEditDescription(module?.description || "")
    setEditPrice(module ? (module.monthlyPriceCents / 100).toFixed(2) : "")
    setEditCapabilitySlugs(module?.includedCapabilitySlugs || [])
  }

  function openAdd() {
    resetDialog(null)
    setDialogOpen(true)
  }

  function openEdit(module: CatalogModule) {
    resetDialog(module)
    setDialogOpen(true)
  }

  function toggleCapability(slug: string, checked: boolean) {
    setEditCapabilitySlugs((current) => {
      const next = new Set(current)
      if (checked) next.add(slug)
      else next.delete(slug)
      return capabilities.map((item) => item.slug).filter((item) => next.has(item))
    })
  }

  async function saveModule() {
    const name = editName.trim()
    if (!name) {
      alert("Enter a module name.")
      return
    }
    const cents = parseUsdToCents(editPrice)
    if (cents == null) {
      alert("Enter a valid monthly price such as 149.00.")
      return
    }
    const slug = slugifyProductModuleSlug(isAdd ? editSlug || name : editingModule?.slug || "")
    setSaving(true)
    try {
      const response = await fetch(
        isAdd ? "/api/platform/modules" : `/api/platform/modules/${editingModule?.id}`,
        {
          method: isAdd ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description: editDescription,
            monthlyPriceCents: cents,
            includedCapabilitySlugs: editCapabilitySlugs,
            ...(isAdd ? { slug } : {}),
          }),
        }
      )
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Failed to save module.")
      if (isAdd) {
        setModules((current) =>
          [...current, result.module].sort((a, b) => a.name.localeCompare(b.name))
        )
      } else {
        setModules((current) =>
          current.map((item) => (item.id === editingModule?.id ? result.module : item))
        )
      }
      setDialogOpen(false)
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save module.")
    } finally {
      setSaving(false)
    }
  }

  async function saveDiscounts() {
    setSavingDiscounts(true)
    try {
      const response = await fetch("/api/platform/module-discount-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discountRules }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Failed to save discounts.")
      setDiscountRules(result.discountRules || discountRules)
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save discounts.")
    } finally {
      setSavingDiscounts(false)
    }
  }

  const maxDiscount = discountRules.reduce(
    (max, rule) => Math.max(max, rule.discountPercent || 0),
    0
  )

  return (
    <>
      <PlatformHeader title="Modules" />
      <div className="flex flex-col gap-6 p-6 pb-10">
        <p className="text-sm text-muted-foreground">
          If this catalog is empty or monthly prices are $0.00, run{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            scripts/274_module_based_subscription_pricing.sql
          </code>{" "}
          then{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            scripts/275_module_included_capabilities.sql
          </code>{" "}
          in the Supabase SQL Editor, then refresh this page.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="border border-border shadow-sm">
            <CardContent className="flex items-start gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <Boxes className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Product modules</p>
                <p className="mt-0.5 text-2xl font-bold">{modules.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border shadow-sm">
            <CardContent className="flex items-start gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <Boxes className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active</p>
                <p className="mt-0.5 text-2xl font-bold">
                  {modules.filter((item) => item.isActive).length}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border shadow-sm">
            <CardContent className="flex items-start gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                <Boxes className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Max multi-module discount
                </p>
                <p className="mt-0.5 text-2xl font-bold">{maxDiscount}%</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border border-border shadow-sm">
          <CardContent className="p-0">
            <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-base font-semibold">Product catalog</h3>
                <p className="text-sm text-muted-foreground">
                  Monthly prices are stored as integer cents. Inactive modules cannot be newly added
                  to an organization. Included capabilities are set in Add / Edit module.
                </p>
              </div>
              <Button onClick={openAdd}>
                <Plus className="mr-1 h-4 w-4" />
                Add module
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Module</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Monthly price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      Loading modules...
                    </TableCell>
                  </TableRow>
                ) : modules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No product modules found. Run SQL scripts 274 and 275.
                    </TableCell>
                  </TableRow>
                ) : (
                  modules.map((module) => {
                    const Icon = moduleIcons[module.slug] || Boxes
                    return (
                      <TableRow key={module.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium">{module.name}</p>
                              <p className="text-xs text-muted-foreground">{module.slug}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[320px] text-sm text-muted-foreground">
                          {module.description || "No description"}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCentsAsUsd(module.monthlyPriceCents)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={module.isActive}
                              onCheckedChange={() => void toggleActive(module)}
                            />
                            <Badge
                              variant="secondary"
                              className={
                                module.isActive
                                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-100"
                              }
                            >
                              {module.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(module)}>
                            <Pencil className="mr-1 h-4 w-4" />
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-base font-semibold">Multi-module discount</h3>
                <p className="text-sm text-muted-foreground">
                  Percent off the module subtotal by selected module count. Annual billing is
                  separate.
                </p>
              </div>
              <Button onClick={() => void saveDiscounts()} disabled={savingDiscounts}>
                {savingDiscounts ? "Saving..." : "Save discounts"}
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[...discountRules]
                .sort((a, b) => a.moduleCount - b.moduleCount)
                .map((rule) => (
                  <div key={rule.moduleCount} className="rounded-lg border p-3">
                    <Label>
                      {rule.moduleCount} module{rule.moduleCount === 1 ? "" : "s"}
                    </Label>
                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={rule.discountPercent}
                        onChange={(event) => {
                          const value = Number(event.target.value)
                          setDiscountRules((current) =>
                            current.map((item) =>
                              item.moduleCount === rule.moduleCount
                                ? {
                                    ...item,
                                    discountPercent: Number.isFinite(value) ? value : 0,
                                  }
                                : item
                            )
                          )
                        }}
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isAdd ? "Add module" : "Edit module"}</DialogTitle>
            <DialogDescription>
              {isAdd
                ? "Create a product module and choose which capabilities it includes."
                : "Update the name, description, monthly price, and included capabilities. Status stays on the table."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="module-name">Module name</Label>
              <Input
                id="module-name"
                value={editName}
                onChange={(event) => {
                  const value = event.target.value
                  setEditName(value)
                  if (isAdd && !slugTouched) {
                    setEditSlug(slugifyProductModuleSlug(value))
                  }
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="module-slug">Slug</Label>
              <Input
                id="module-slug"
                value={editSlug}
                disabled={!isAdd}
                onChange={(event) => {
                  setSlugTouched(true)
                  setEditSlug(slugifyProductModuleSlug(event.target.value) || event.target.value)
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="module-description">Description</Label>
              <Textarea
                id="module-description"
                rows={3}
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="module-price">Monthly price (USD)</Label>
              <Input
                id="module-price"
                value={editPrice}
                onChange={(event) => setEditPrice(event.target.value)}
                placeholder="149.00"
              />
            </div>
            <div className="grid gap-2">
              <Label>Included capabilities</Label>
              <p className="text-xs text-muted-foreground">
                Select every capability this product module should turn on for a tenant.
              </p>
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
                {capabilities.map((capability) => {
                  const checked = editCapabilitySlugs.includes(capability.slug)
                  return (
                    <label
                      key={capability.slug}
                      className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) =>
                          toggleCapability(capability.slug, value === true)
                        }
                      />
                      <span className="text-sm">{capability.name}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveModule()} disabled={saving}>
              {saving ? "Saving..." : isAdd ? "Add module" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
