"use client"

import { useEffect, useState, useTransition } from "react"
import { GripVertical, Loader2, Pencil, Plus, Trash2 } from "lucide-react"

import { Header } from "@/components/layout/header"
import { VenueRentalsSettingsNav } from "@/components/bookings/venue-rentals-settings-nav"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  deleteRentalAddon,
  reorderRentalAddons,
  upsertRentalAddon,
} from "@/lib/bookings/venue-rental-addon-actions"
import type { RentalAddonSettingsItem } from "@/lib/bookings/venue-rental-types"
import { cn } from "@/lib/utils"

type AddonFormState = {
  id?: string
  name: string
  description: string
  defaultPrice: string
  isActive: boolean
}

const emptyForm = (): AddonFormState => ({
  name: "",
  description: "",
  defaultPrice: "0",
  isActive: true,
})

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value) || 0)
}

function nextSortOrder(items: RentalAddonSettingsItem[]) {
  const max = items.reduce((highest, item) => Math.max(highest, item.sortOrder), 0)
  return max + 10
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex) return items
  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

export function VenueRentalAddonsClient({
  addons,
}: {
  addons: RentalAddonSettingsItem[]
}) {
  const [rows, setRows] = useState(addons)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<AddonFormState>(emptyForm())
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)

  useEffect(() => {
    setRows(addons)
  }, [addons])

  function openCreate() {
    setForm(emptyForm())
    setError(null)
    setDialogOpen(true)
  }

  function openEdit(row: RentalAddonSettingsItem) {
    setForm({
      id: row.id,
      name: row.name,
      description: row.description || "",
      defaultPrice: String(row.defaultPrice),
      isActive: row.isActive,
    })
    setError(null)
    setDialogOpen(true)
  }

  function handleSave() {
    setError(null)

    startTransition(async () => {
      try {
        await upsertRentalAddon({
          id: form.id,
          name: form.name,
          description: form.description,
          defaultPrice: Number(form.defaultPrice),
          isActive: form.isActive,
          sortOrder: form.id
            ? rows.find((row) => row.id === form.id)?.sortOrder ?? 0
            : nextSortOrder(rows),
        })
        setDialogOpen(false)
      } catch (saveError) {
        setError(
          saveError instanceof Error ? saveError.message : "Failed to save add-on"
        )
      }
    })
  }

  function handleDelete(row: RentalAddonSettingsItem) {
    if (!window.confirm(`Delete "${row.name}"?`)) {
      return
    }

    startTransition(async () => {
      try {
        const result = await deleteRentalAddon(row.id)
        if (result.deactivated) {
          window.alert(
            `"${row.name}" is used on existing rentals, so it was deactivated instead of deleted.`
          )
        }
      } catch (deleteError) {
        window.alert(
          deleteError instanceof Error
            ? deleteError.message
            : "Failed to delete add-on"
        )
      }
    })
  }

  function persistOrder(nextRows: RentalAddonSettingsItem[]) {
    const previous = rows
    setRows(nextRows)
    startTransition(async () => {
      try {
        await reorderRentalAddons(nextRows.map((row) => row.id))
      } catch (reorderError) {
        setRows(previous)
        window.alert(
          reorderError instanceof Error
            ? reorderError.message
            : "Failed to save add-on order"
        )
      }
    })
  }

  function handleDrop(toIndex: number) {
    if (draggedIndex === null || draggedIndex === toIndex) {
      setDraggedIndex(null)
      setDropTargetIndex(null)
      return
    }

    const nextRows = moveItem(rows, draggedIndex, toIndex).map((row, index) => ({
      ...row,
      sortOrder: (index + 1) * 10,
    }))
    setDraggedIndex(null)
    setDropTargetIndex(null)
    persistOrder(nextRows)
  }

  return (
    <>
      <Header title="Venue Rentals" />

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <div>
          <h2 className="text-xl font-semibold">Settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure venue rental options for your organization.
          </p>
        </div>

        <VenueRentalsSettingsNav />

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Add-ons</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Extra charges customers can select with a venue rental request.
                Drag rows to reorder.
              </p>
            </div>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add add-on
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Add-on</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No add-ons yet. Add table covers, chair covers, and other
                      extras.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row, index) => (
                    <TableRow
                      key={row.id}
                      className={cn(
                        draggedIndex === index && "opacity-50",
                        dropTargetIndex === index &&
                          draggedIndex !== index &&
                          "bg-primary/5 ring-1 ring-inset ring-primary/20"
                      )}
                      onDragOver={(event) => {
                        event.preventDefault()
                        event.dataTransfer.dropEffect = "move"
                        setDropTargetIndex(index)
                      }}
                      onDragLeave={() => {
                        setDropTargetIndex((current) =>
                          current === index ? null : current
                        )
                      }}
                      onDrop={(event) => {
                        event.preventDefault()
                        handleDrop(index)
                      }}
                    >
                      <TableCell className="w-10 align-middle">
                        <button
                          type="button"
                          draggable={!isPending}
                          aria-label={`Reorder ${row.name}`}
                          title="Drag to reorder"
                          className="flex h-8 w-8 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={isPending}
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = "move"
                            event.dataTransfer.setData("text/plain", String(index))
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
                      <TableCell>
                        <p className="font-medium">{row.name}</p>
                        {row.description ? (
                          <p className="text-xs text-muted-foreground">
                            {row.description}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(row.defaultPrice)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(row)}
                            disabled={isPending}
                            aria-label={`Edit ${row.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(row)}
                            disabled={isPending}
                            aria-label={`Delete ${row.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit add-on" : "Add add-on"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="addon-name">Name</Label>
              <Input
                id="addon-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Table Covers"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addon-price">Price each</Label>
              <Input
                id="addon-price"
                type="number"
                min={0}
                step="0.01"
                value={form.defaultPrice}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    defaultPrice: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addon-description">Description</Label>
              <Textarea
                id="addon-description"
                rows={3}
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Optional"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">
                  Inactive add-ons are hidden from new requests.
                </p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, isActive: checked }))
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
