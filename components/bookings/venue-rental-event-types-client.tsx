"use client"

import { useState, useTransition } from "react"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"

import { Header } from "@/components/layout/header"
import { FacilitiesSettingsNav } from "@/components/bookings/bookings-settings-nav"
import { Badge } from "@/components/ui/badge"
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
  deleteVenueRentalEventType,
  upsertVenueRentalEventType,
} from "@/lib/bookings/venue-rental-event-type-actions"
import type { VenueRentalEventType } from "@/lib/bookings/venue-rental-event-type-types"

type EventTypeFormState = {
  id?: string
  name: string
  description: string
  is_active: boolean
  sort_order: number
}

const emptyForm = (): EventTypeFormState => ({
  name: "",
  description: "",
  is_active: true,
  sort_order: 0,
})

export function VenueRentalEventTypesClient({
  venueRentalEventTypes,
}: {
  venueRentalEventTypes: VenueRentalEventType[]
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<EventTypeFormState>(emptyForm())
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function openCreate() {
    setForm(emptyForm())
    setError(null)
    setDialogOpen(true)
  }

  function openEdit(row: VenueRentalEventType) {
    setForm({
      id: row.id,
      name: row.name,
      description: row.description || "",
      is_active: row.is_active,
      sort_order: row.sort_order,
    })
    setError(null)
    setDialogOpen(true)
  }

  function handleSave() {
    setError(null)

    startTransition(async () => {
      try {
        await upsertVenueRentalEventType({
          id: form.id,
          name: form.name,
          description: form.description,
          is_active: form.is_active,
          sort_order: form.sort_order,
        })
        setDialogOpen(false)
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Failed to save event type"
        )
      }
    })
  }

  function handleDelete(row: VenueRentalEventType) {
    if (!window.confirm(`Delete "${row.name}"?`)) {
      return
    }

    startTransition(async () => {
      try {
        await deleteVenueRentalEventType(row.id)
      } catch (deleteError) {
        window.alert(
          deleteError instanceof Error
            ? deleteError.message
            : "Failed to delete event type"
        )
      }
    })
  }

  return (
    <>
      <Header title="Bookings" />

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <div>
          <h2 className="text-xl font-semibold">Settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure spaces and facility options for your organization.
          </p>
        </div>

        <FacilitiesSettingsNav />

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Event Types</CardTitle>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add type
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sr-only">Event type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sort</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {venueRentalEventTypes.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No event types yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  venueRentalEventTypes.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <p className="font-medium">{row.name}</p>
                        {row.description ? (
                          <p className="text-xs text-muted-foreground">
                            {row.description}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.is_active ? "default" : "secondary"}>
                          {row.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.sort_order}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(row)}
                            disabled={isPending}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(row)}
                            disabled={isPending}
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
            <DialogTitle>
              {form.id ? "Edit event type" : "Add event type"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="type-name">Name</Label>
              <Input
                id="type-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Wedding"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type-description">Description</Label>
              <Textarea
                id="type-description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={3}
                placeholder="Optional description for staff"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type-sort">Sort order</Label>
              <Input
                id="type-sort"
                type="number"
                value={form.sort_order}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    sort_order: Number(event.target.value) || 0,
                  }))
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">
                  Inactive types are hidden on new forms.
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
