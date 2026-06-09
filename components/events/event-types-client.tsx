"use client"

import { useState, useTransition } from "react"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"

import { Header } from "@/components/layout/header"
import { EventManagementSettingsNav } from "@/components/events/event-management-settings-nav"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
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
import type { EventType } from "@/lib/events/event-type-types"
import { deleteEventType, upsertEventType } from "@/lib/events/event-type-actions"

type EventTypeFormState = {
  id?: string
  name: string
  description: string
  is_active: boolean
  sort_order: number
}

const emptyForm: EventTypeFormState = {
  name: "",
  description: "",
  is_active: true,
  sort_order: 0,
}

export function EventTypesClient({ eventTypes }: { eventTypes: EventType[] }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<EventTypeFormState>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function openCreate() {
    setForm(emptyForm)
    setError(null)
    setDialogOpen(true)
  }

  function openEdit(eventType: EventType) {
    setForm({
      id: eventType.id,
      name: eventType.name,
      description: eventType.description || "",
      is_active: eventType.is_active,
      sort_order: eventType.sort_order,
    })
    setError(null)
    setDialogOpen(true)
  }

  function handleSave() {
    setError(null)

    startTransition(async () => {
      try {
        await upsertEventType({
          id: form.id,
          name: form.name,
          description: form.description,
          is_active: form.is_active,
          sort_order: form.sort_order,
        })
        setDialogOpen(false)
      } catch (saveError) {
        setError(
          saveError instanceof Error ? saveError.message : "Failed to save event type"
        )
      }
    })
  }

  function handleDelete(eventType: EventType) {
    if (!window.confirm(`Delete "${eventType.name}"?`)) {
      return
    }

    startTransition(async () => {
      try {
        await deleteEventType(eventType.id)
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
      <Header title="Event Management" />

      <div className="flex flex-col gap-6 p-6">
        <div>
          <h2 className="text-xl font-semibold">Settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure internal event options for your organization.
          </p>
        </div>

        <EventManagementSettingsNav />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Event Types</h1>
            <p className="text-muted-foreground">
              Configure the types available when creating internal events.
            </p>
          </div>

          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Event Type
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Organization event types</CardTitle>
            <CardDescription>
              Default types were seeded for your organization. You can add custom types
              as needed.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sort</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventTypes.map((eventType) => (
                  <TableRow key={eventType.id}>
                    <TableCell>
                      <p className="font-medium">{eventType.name}</p>
                      {eventType.description ? (
                        <p className="text-xs text-muted-foreground">
                          {eventType.description}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={eventType.is_active ? "default" : "secondary"}>
                        {eventType.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>{eventType.sort_order}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(eventType)}
                          disabled={isPending}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(eventType)}
                          disabled={isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Event Type" : "Add Event Type"}</DialogTitle>
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
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type-description">Description</Label>
              <Textarea
                id="type-description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                rows={3}
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
                  Inactive types are hidden when creating events.
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
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isPending}>
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
