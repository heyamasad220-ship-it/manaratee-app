"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { GripVertical, Loader2, Pencil, Plus, Trash2 } from "lucide-react"

import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  deleteFacilityInventoryItem,
  reorderFacilityInventoryItems,
  upsertFacilityInventoryItem,
} from "@/lib/facility-inventory/facility-inventory-actions"
import {
  FACILITY_INVENTORY_CATEGORY_LABELS,
  FACILITY_INVENTORY_CATEGORY_OPTIONS,
  facilityInventoryLineTotal,
  formatFacilityInventoryVariant,
  type FacilityInventoryCategory,
  type FacilityInventoryItem,
} from "@/lib/facility-inventory/facility-inventory-types"
import { cn } from "@/lib/utils"

type InventoryFormState = {
  id?: string
  name: string
  category: FacilityInventoryCategory
  description: string
  size: string
  style: string
  color: string
  quantity: number
  location: string
  notes: string
  purchased_at: string
  unit_cost: string
  is_active: boolean
}

const emptyForm: InventoryFormState = {
  name: "",
  category: "equipment",
  description: "",
  size: "",
  style: "",
  color: "",
  quantity: 1,
  location: "",
  notes: "",
  purchased_at: "",
  unit_cost: "",
  is_active: true,
}

function nextSortOrder(items: FacilityInventoryItem[]) {
  const max = items.reduce((highest, item) => Math.max(highest, item.sort_order), 0)
  return max + 10
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex) return items
  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

function formatMoney(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value)
}

function formatPurchaseDate(value: string | null) {
  if (!value) return "—"
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function FacilityInventoryClient({
  items,
  tablesAvailable = true,
  canManage = false,
}: {
  items: FacilityInventoryItem[]
  tablesAvailable?: boolean
  canManage?: boolean
}) {
  const [rows, setRows] = useState(items)
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<InventoryFormState>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)

  useEffect(() => {
    setRows(items)
  }, [items])

  const filteredRows = useMemo(() => {
    if (categoryFilter === "all") return rows
    return rows.filter((row) => row.category === categoryFilter)
  }, [rows, categoryFilter])

  function openCreate() {
    setForm({
      ...emptyForm,
      category:
        categoryFilter !== "all"
          ? (categoryFilter as FacilityInventoryCategory)
          : "equipment",
    })
    setError(null)
    setDialogOpen(true)
  }

  function openEdit(item: FacilityInventoryItem) {
    setForm({
      id: item.id,
      name: item.name,
      category: item.category,
      description: item.description || "",
      size: item.size || "",
      style: item.style || "",
      color: item.color || "",
      quantity: item.quantity,
      location: item.location || "",
      notes: item.notes || "",
      purchased_at: item.purchased_at || "",
      unit_cost: item.unit_cost == null ? "" : String(item.unit_cost),
      is_active: item.is_active,
    })
    setError(null)
    setDialogOpen(true)
  }

  function handleSave() {
    setError(null)

    const unitCostValue = form.unit_cost.trim()
      ? Number.parseFloat(form.unit_cost.trim())
      : null

    if (
      unitCostValue !== null &&
      (!Number.isFinite(unitCostValue) || unitCostValue < 0)
    ) {
      setError("Unit cost must be a non-negative number.")
      return
    }

    startTransition(async () => {
      try {
        await upsertFacilityInventoryItem({
          id: form.id,
          name: form.name,
          category: form.category,
          description: form.description,
          size: form.size,
          style: form.style,
          color: form.color,
          quantity: form.quantity,
          location: form.location,
          notes: form.notes,
          purchased_at: form.purchased_at || null,
          unit_cost: unitCostValue,
          is_active: form.is_active,
          sort_order: form.id
            ? rows.find((row) => row.id === form.id)?.sort_order ?? 0
            : nextSortOrder(rows),
        })
        setDialogOpen(false)
      } catch (saveError) {
        setError(
          saveError instanceof Error ? saveError.message : "Failed to save inventory item"
        )
      }
    })
  }

  function handleDelete(item: FacilityInventoryItem) {
    if (!window.confirm(`Delete "${item.name}"?`)) {
      return
    }

    startTransition(async () => {
      try {
        await deleteFacilityInventoryItem(item.id)
      } catch (deleteError) {
        window.alert(
          deleteError instanceof Error
            ? deleteError.message
            : "Failed to delete inventory item"
        )
      }
    })
  }

  function persistOrder(nextRows: FacilityInventoryItem[]) {
    const previous = rows
    setRows(nextRows)
    startTransition(async () => {
      try {
        await reorderFacilityInventoryItems(nextRows.map((row) => row.id))
      } catch (reorderError) {
        setRows(previous)
        window.alert(
          reorderError instanceof Error
            ? reorderError.message
            : "Failed to save inventory order"
        )
      }
    })
  }

  function handleDropOnFilteredIndex(filteredToIndex: number) {
    if (draggedIndex === null) {
      setDropTargetIndex(null)
      return
    }

    const fromItem = filteredRows[draggedIndex]
    const toItem = filteredRows[filteredToIndex]
    if (!fromItem || !toItem || fromItem.id === toItem.id) {
      setDraggedIndex(null)
      setDropTargetIndex(null)
      return
    }

    const fromIndex = rows.findIndex((row) => row.id === fromItem.id)
    const toIndex = rows.findIndex((row) => row.id === toItem.id)
    if (fromIndex < 0 || toIndex < 0) {
      setDraggedIndex(null)
      setDropTargetIndex(null)
      return
    }

    const nextRows = moveItem(rows, fromIndex, toIndex).map((row, index) => ({
      ...row,
      sort_order: (index + 1) * 10,
    }))
    setDraggedIndex(null)
    setDropTargetIndex(null)
    persistOrder(nextRows)
  }

  const colSpan = canManage ? 8 : 7

  return (
    <>
      <Header title="Facilities" />

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track furniture, seating, supplies, and equipment. Drag rows to reorder.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="w-full sm:w-[220px]">
              <Label className="sr-only">Category filter</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {FACILITY_INVENTORY_CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {canManage ? (
              <Button onClick={openCreate} disabled={!tablesAvailable}>
                <Plus className="mr-2 h-4 w-4" />
                Add item
              </Button>
            ) : null}
          </div>
        </div>

        {!tablesAvailable ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Run migration `207_facility_inventory_items.sql`, then
              `208_facility_inventory_phase1_fields.sql`, in Supabase to enable facility
              inventory.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow>
                      {canManage ? <TableHead className="w-10" /> : null}
                      <TableHead>Item</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="w-[80px]">Qty</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Purchased</TableHead>
                      <TableHead className="text-right">Unit / total</TableHead>
                      {canManage ? (
                        <TableHead className="w-[120px]">Actions</TableHead>
                      ) : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={colSpan}
                          className="h-24 text-center text-muted-foreground"
                        >
                          No inventory items
                          {categoryFilter !== "all" ? " in this category" : ""} yet.
                          {canManage
                            ? " Add tables, chairs, paper goods, and more."
                            : ""}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRows.map((item, index) => {
                        const variant = formatFacilityInventoryVariant(item)
                        const lineTotal = facilityInventoryLineTotal(item)
                        return (
                          <TableRow
                            key={item.id}
                            className={cn(
                              !item.is_active && "opacity-60",
                              draggedIndex === index && "opacity-50",
                              dropTargetIndex === index &&
                                draggedIndex !== index &&
                                "bg-primary/5 ring-1 ring-inset ring-primary/20"
                            )}
                            onDragOver={
                              canManage
                                ? (event) => {
                                    event.preventDefault()
                                    event.dataTransfer.dropEffect = "move"
                                    setDropTargetIndex(index)
                                  }
                                : undefined
                            }
                            onDragLeave={
                              canManage
                                ? () => {
                                    setDropTargetIndex((current) =>
                                      current === index ? null : current
                                    )
                                  }
                                : undefined
                            }
                            onDrop={
                              canManage
                                ? (event) => {
                                    event.preventDefault()
                                    handleDropOnFilteredIndex(index)
                                  }
                                : undefined
                            }
                          >
                            {canManage ? (
                              <TableCell className="w-10 align-middle">
                                <button
                                  type="button"
                                  draggable={!isPending}
                                  aria-label={`Reorder ${item.name}`}
                                  title="Drag to reorder"
                                  className="flex h-8 w-8 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
                                  disabled={isPending}
                                  onDragStart={(event) => {
                                    event.dataTransfer.effectAllowed = "move"
                                    event.dataTransfer.setData(
                                      "text/plain",
                                      String(index)
                                    )
                                    setDraggedIndex(index)
                                  }}
                                  onDragEnd={() => {
                                    setDraggedIndex(null)
                                    setDropTargetIndex(null)
                                  }}
                                >
                                  <GripVertical className="h-4 w-4" />
                                </button>
                              </TableCell>
                            ) : null}
                            <TableCell>
                              <p className="font-medium">{item.name}</p>
                              {variant ? (
                                <p className="text-xs text-muted-foreground">{variant}</p>
                              ) : null}
                              {item.description ? (
                                <p className="text-xs text-muted-foreground">
                                  {item.description}
                                </p>
                              ) : null}
                              {!item.is_active ? (
                                <p className="text-xs text-muted-foreground">Inactive</p>
                              ) : null}
                            </TableCell>
                            <TableCell>
                              {FACILITY_INVENTORY_CATEGORY_LABELS[item.category]}
                            </TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {item.location || "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatPurchaseDate(item.purchased_at)}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              <div>{formatMoney(item.unit_cost)}</div>
                              {lineTotal != null ? (
                                <div className="text-xs text-muted-foreground">
                                  {formatMoney(lineTotal)} total
                                </div>
                              ) : null}
                            </TableCell>
                            {canManage ? (
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEdit(item)}
                                    disabled={isPending}
                                    aria-label={`Edit ${item.name}`}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDelete(item)}
                                    disabled={isPending}
                                    aria-label={`Delete ${item.name}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            ) : null}
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {form.id ? "Edit inventory item" : "Add inventory item"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="inventory-name">Name</Label>
              <Input
                id="inventory-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Round table, Gold chair, Paper towels…"
              />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    category: value as FacilityInventoryCategory,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FACILITY_INVENTORY_CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="inventory-size">Size</Label>
                <Input
                  id="inventory-size"
                  value={form.size}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, size: event.target.value }))
                  }
                  placeholder="60 inch"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inventory-style">Style</Label>
                <Input
                  id="inventory-style"
                  value={form.style}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, style: event.target.value }))
                  }
                  placeholder="Foldable"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inventory-color">Color</Label>
                <Input
                  id="inventory-color"
                  value={form.color}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, color: event.target.value }))
                  }
                  placeholder="Gold"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="inventory-qty">Quantity</Label>
                <Input
                  id="inventory-qty"
                  type="number"
                  min={0}
                  value={form.quantity}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      quantity: Number(event.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inventory-location">Location</Label>
                <Input
                  id="inventory-location"
                  value={form.location}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, location: event.target.value }))
                  }
                  placeholder="Storage closet A"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="inventory-purchased">Purchase date</Label>
                <Input
                  id="inventory-purchased"
                  type="date"
                  value={form.purchased_at}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      purchased_at: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inventory-unit-cost">Unit cost ($)</Label>
                <Input
                  id="inventory-unit-cost"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.unit_cost}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      unit_cost: event.target.value,
                    }))
                  }
                  placeholder="12.99"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="inventory-description">Description</Label>
              <Textarea
                id="inventory-description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="inventory-notes">Notes</Label>
              <Textarea
                id="inventory-notes"
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, notes: event.target.value }))
                }
                rows={2}
                placeholder="Vendor, care notes, reorder reminder…"
              />
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">
                  Inactive items stay listed but are marked as inactive.
                </p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, is_active: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
