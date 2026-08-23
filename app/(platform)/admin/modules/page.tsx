"use client"

import { useEffect, useState } from "react"
import { PlatformHeader } from "@/components/platform/platform-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Boxes, Calendar, GraduationCap, Heart, Pencil, Store, Ticket, Users } from "lucide-react"
import { formatCentsAsUsd, parseUsdToCents } from "@/lib/billing/money"
import { productModuleIncludesCaption } from "@/lib/modules/staff-module-labels"

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

const moduleIcons: Record<string, React.ElementType> = {
  "event-management": Ticket,
  programs: GraduationCap,
  "vendor-hub": Store,
  bookings: Calendar,
  donations: Heart,
  membership: Users,
}

export default function ModulesPage() {
  const [modules, setModules] = useState<CatalogModule[]>([])
  const [discountRules, setDiscountRules] = useState<DiscountRule[]>([])
  const [loading, setLoading] = useState(true)
  const [editingModule, setEditingModule] = useState<CatalogModule | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingDiscounts, setSavingDiscounts] = useState(false)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editPrice, setEditPrice] = useState("")

  async function loadCatalog() {
    setLoading(true)
    try {
      const response = await fetch("/api/platform/modules")
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Failed to load modules.")
      setModules(result.modules || [])
      setDiscountRules(result.discountRules || [])
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

  function openEdit(module: CatalogModule) {
    setEditingModule(module)
    setEditName(module.name)
    setEditDescription(module.description || "")
    setEditPrice((module.monthlyPriceCents / 100).toFixed(2))
    setDialogOpen(true)
  }

  async function saveEdit() {
    if (!editingModule) return
    const cents = parseUsdToCents(editPrice)
    if (cents == null) {
      alert("Enter a valid monthly price such as 149.00.")
      return
    }
    setSaving(true)
    try {
      const response = await fetch(`/api/platform/modules/${editingModule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          description: editDescription,
          monthlyPriceCents: cents,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Failed to save module.")
      setModules((current) =>
        current.map((item) => (item.id === editingModule.id ? result.module : item))
      )
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
      <div className="flex flex-col gap-6 p-6">
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
            <div className="border-b border-border px-5 py-4">
              <h3 className="text-base font-semibold">Product catalog</h3>
              <p className="text-sm text-muted-foreground">
                Monthly prices are stored as integer cents. Inactive modules cannot be newly added
                to an organization.
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Module</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Monthly price</TableHead>
                  <TableHead>Included with this module</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Loading modules...
                    </TableCell>
                  </TableRow>
                ) : modules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No product modules found. Run SQL script 274.
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
                        <TableCell className="max-w-[280px] text-sm text-muted-foreground">
                          {module.description || "No description"}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCentsAsUsd(module.monthlyPriceCents)}
                        </TableCell>
                        <TableCell className="max-w-[260px] text-sm text-muted-foreground">
                          {productModuleIncludesCaption(module.slug) || "—"}
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
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit module</DialogTitle>
            <DialogDescription>
              Update the name, description, and monthly price. Status stays on the table.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="module-name">Module name</Label>
              <Input
                id="module-name"
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveEdit()} disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
