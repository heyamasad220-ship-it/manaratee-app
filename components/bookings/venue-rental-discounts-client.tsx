"use client"

import { useEffect, useState, useTransition } from "react"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"

import { Header } from "@/components/layout/header"
import { VenueRentalsSettingsNav } from "@/components/bookings/venue-rentals-settings-nav"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
  deleteVenueRentalDiscountPolicy,
  upsertVenueRentalDiscountPolicy,
} from "@/lib/bookings/venue-rental-discount-actions"
import type {
  VenueRentalDiscountPolicySettingsItem,
  VenueRentalDiscountType,
} from "@/lib/bookings/venue-rental-types"

type DiscountTagOption = {
  id: string
  name: string
}

type DiscountFormState = {
  id?: string
  name: string
  description: string
  discountType: VenueRentalDiscountType
  amount: string
  requiresMultiVenue: boolean
  minVenues: string
  discountTagId: string
  isActive: boolean
}

const emptyForm = (): DiscountFormState => ({
  name: "",
  description: "",
  discountType: "percent",
  amount: "10",
  requiresMultiVenue: false,
  minVenues: "2",
  discountTagId: "",
  isActive: true,
})

function formatDiscountValue(row: VenueRentalDiscountPolicySettingsItem) {
  if (row.discountType === "percent") {
    return `${row.amount}%`
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(row.amount)
}

function conditionLabel(row: VenueRentalDiscountPolicySettingsItem) {
  const parts: string[] = []
  if (row.requiresMultiVenue) {
    parts.push(`${row.minVenues}+ venues`)
  }
  if (row.discountTagName) {
    parts.push(`Tag: ${row.discountTagName}`)
  }
  return parts.length ? parts.join(" · ") : "—"
}

export function VenueRentalDiscountsClient({
  policies,
  discountTags,
}: {
  policies: VenueRentalDiscountPolicySettingsItem[]
  discountTags: DiscountTagOption[]
}) {
  const [rows, setRows] = useState(policies)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<DiscountFormState>(emptyForm())
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setRows(policies)
  }, [policies])

  function openCreate() {
    setForm(emptyForm())
    setError(null)
    setDialogOpen(true)
  }

  function openEdit(row: VenueRentalDiscountPolicySettingsItem) {
    setForm({
      id: row.id,
      name: row.name,
      description: row.description || "",
      discountType: row.discountType,
      amount: String(row.amount),
      requiresMultiVenue: row.requiresMultiVenue,
      minVenues: String(row.minVenues),
      discountTagId: row.discountTagId || "",
      isActive: row.isActive,
    })
    setError(null)
    setDialogOpen(true)
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      try {
        await upsertVenueRentalDiscountPolicy({
          id: form.id,
          name: form.name,
          description: form.description,
          discountType: form.discountType,
          amount: Number(form.amount),
          requiresMultiVenue: form.requiresMultiVenue,
          minVenues: Number(form.minVenues) || 2,
          discountTagId: form.discountTagId || null,
          isActive: form.isActive,
          sortOrder: form.id
            ? rows.find((row) => row.id === form.id)?.sortOrder
            : (rows.reduce((max, row) => Math.max(max, row.sortOrder), 0) || 0) +
              10,
        })
        setDialogOpen(false)
      } catch (saveError) {
        setError(
          saveError instanceof Error ? saveError.message : "Failed to save discount"
        )
      }
    })
  }

  function handleDelete(row: VenueRentalDiscountPolicySettingsItem) {
    if (!window.confirm(`Delete discount "${row.name}"?`)) return
    setError(null)
    startTransition(async () => {
      try {
        await deleteVenueRentalDiscountPolicy(row.id)
      } catch (deleteError) {
        setError(
          deleteError instanceof Error
            ? deleteError.message
            : "Failed to delete discount"
        )
      }
    })
  }

  return (
    <>
      <Header title="Venue Rentals" />
      <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
        <VenueRentalsSettingsNav />

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div className="space-y-1.5">
              <CardTitle>Discounts</CardTitle>
              <CardDescription>
                Optional rental discounts: fixed amount or percent off the space
                fee. Eligibility uses multi-venue bookings and/or Contacts
                discount tags (non-profit, top donor, etc.). When several match,
                the largest savings wins. Add-ons stay separate.
              </CardDescription>
            </div>
            <Button type="button" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add discount
            </Button>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Conditions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-28 text-center text-muted-foreground"
                    >
                      No discounts yet. Add optional policies for multi-venue or
                      tagged contacts.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium">{row.name}</div>
                        {row.description ? (
                          <div className="text-xs text-muted-foreground">
                            {row.description}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatDiscountValue(row)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {conditionLabel(row)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.isActive ? "default" : "secondary"}>
                          {row.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={isPending}
                            onClick={() => openEdit(row)}
                            aria-label={`Edit ${row.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            disabled={isPending}
                            onClick={() => handleDelete(row)}
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {form.id ? "Edit discount" : "Add discount"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="discount-name">Name</Label>
              <Input
                id="discount-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Non-profit rate"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount-description">Description</Label>
              <Textarea
                id="discount-description"
                rows={2}
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={form.discountType}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      discountType: value as VenueRentalDiscountType,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percent off</SelectItem>
                    <SelectItem value="fixed">Fixed amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount-amount">
                  {form.discountType === "percent" ? "Percent" : "Amount ($)"}
                </Label>
                <Input
                  id="discount-amount"
                  type="number"
                  min={0}
                  max={form.discountType === "percent" ? 100 : undefined}
                  step="0.01"
                  value={form.amount}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      amount: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-3 rounded-md border border-border p-3">
              <p className="text-sm font-medium">Conditions</p>
              <p className="text-xs text-muted-foreground">
                Choose at least one. Contact tags are managed under Contacts →
                Settings → Discount Tags.
              </p>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="multi-venue"
                  checked={form.requiresMultiVenue}
                  onCheckedChange={(checked) =>
                    setForm((current) => ({
                      ...current,
                      requiresMultiVenue: checked === true,
                    }))
                  }
                />
                <div className="space-y-2">
                  <Label htmlFor="multi-venue" className="font-normal">
                    Multi-venue booking
                  </Label>
                  {form.requiresMultiVenue ? (
                    <div className="flex items-center gap-2">
                      <Label htmlFor="min-venues" className="text-xs">
                        Minimum venues
                      </Label>
                      <Input
                        id="min-venues"
                        type="number"
                        min={2}
                        className="h-8 w-20"
                        value={form.minVenues}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            minVenues: event.target.value,
                          }))
                        }
                      />
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Contact discount tag</Label>
                <Select
                  value={form.discountTagId || "none"}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      discountTagId: value === "none" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Optional tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No tag required</SelectItem>
                    {discountTags.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id}>
                        {tag.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <Label htmlFor="discount-active">Active</Label>
              <Switch
                id="discount-active"
                checked={form.isActive}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, isActive: checked }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
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
