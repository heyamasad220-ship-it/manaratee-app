"use client"

import { useEffect, useState, useTransition } from "react"
import { GripVertical, Loader2, Pencil, Plus, Trash2 } from "lucide-react"

import { Header } from "@/components/layout/header"
import { FacilitiesSettingsNav } from "@/components/bookings/bookings-settings-nav"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
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
  deleteRoomSetupStyle,
  reorderRoomSetupStyles,
  upsertRoomSetupStyle,
} from "@/lib/setup-styles/setup-style-actions"
import type { RoomSetupStyle } from "@/lib/setup-styles/setup-style-types"
import { cn } from "@/lib/utils"

type SetupStyleFormState = {
  id?: string
  name: string
  description: string
  is_active: boolean
}

const emptyForm: SetupStyleFormState = {
  name: "",
  description: "",
  is_active: true,
}

function nextSortOrder(styles: RoomSetupStyle[]) {
  const max = styles.reduce((highest, style) => Math.max(highest, style.sort_order), 0)
  return max + 10
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex) return items
  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

export function SetupStylesClient({
  setupStyles,
  tablesAvailable = true,
}: {
  setupStyles: RoomSetupStyle[]
  tablesAvailable?: boolean
}) {
  const [rows, setRows] = useState(setupStyles)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<SetupStyleFormState>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)

  useEffect(() => {
    setRows(setupStyles)
  }, [setupStyles])

  function openCreate() {
    setForm(emptyForm)
    setError(null)
    setDialogOpen(true)
  }

  function openEdit(setupStyle: RoomSetupStyle) {
    setForm({
      id: setupStyle.id,
      name: setupStyle.name,
      description: setupStyle.description || "",
      is_active: setupStyle.is_active,
    })
    setError(null)
    setDialogOpen(true)
  }

  function handleSave() {
    setError(null)

    startTransition(async () => {
      try {
        await upsertRoomSetupStyle({
          id: form.id,
          name: form.name,
          description: form.description,
          is_active: form.is_active,
          sort_order: form.id
            ? rows.find((row) => row.id === form.id)?.sort_order ?? 0
            : nextSortOrder(rows),
        })
        setDialogOpen(false)
      } catch (saveError) {
        setError(
          saveError instanceof Error ? saveError.message : "Failed to save setup style"
        )
      }
    })
  }

  function handleDelete(setupStyle: RoomSetupStyle) {
    if (!window.confirm(`Delete "${setupStyle.name}"?`)) {
      return
    }

    startTransition(async () => {
      try {
        await deleteRoomSetupStyle(setupStyle.id)
      } catch (deleteError) {
        window.alert(
          deleteError instanceof Error
            ? deleteError.message
            : "Failed to delete setup style"
        )
      }
    })
  }

  function persistOrder(nextRows: RoomSetupStyle[]) {
    const previous = rows
    setRows(nextRows)
    startTransition(async () => {
      try {
        await reorderRoomSetupStyles(nextRows.map((row) => row.id))
      } catch (reorderError) {
        setRows(previous)
        window.alert(
          reorderError instanceof Error
            ? reorderError.message
            : "Failed to save setup style order"
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
      sort_order: (index + 1) * 10,
    }))
    setDraggedIndex(null)
    setDropTargetIndex(null)
    persistOrder(nextRows)
  }

  return (
    <>
      <Header title="Facilities" />

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <div>
          <h2 className="text-xl font-semibold">Settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure spaces and facility options for your organization.
          </p>
        </div>

        <FacilitiesSettingsNav />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Setup Styles</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Drag rows to set the order shown on booking forms.
            </p>
          </div>

          <Button onClick={openCreate} disabled={!tablesAvailable}>
            <Plus className="mr-2 h-4 w-4" />
            Add Setup Style
          </Button>
        </div>

        {!tablesAvailable ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Run migration `073_room_setup_styles.sql` in Supabase to enable setup
              style management.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Name</TableHead>
                    <TableHead className="w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                        No setup styles yet. Add one to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((setupStyle, index) => (
                      <TableRow
                        key={setupStyle.id}
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
                            aria-label={`Reorder ${setupStyle.name}`}
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
                          <p className="font-medium">{setupStyle.name}</p>
                          {setupStyle.description ? (
                            <p className="text-xs text-muted-foreground">
                              {setupStyle.description}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(setupStyle)}
                              disabled={isPending}
                              aria-label={`Edit ${setupStyle.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(setupStyle)}
                              disabled={isPending}
                              aria-label={`Delete ${setupStyle.name}`}
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
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Setup Style" : "Add Setup Style"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="style-name">Name</Label>
              <Input
                id="style-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="style-description">Description</Label>
              <Textarea
                id="style-description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">
                  Inactive styles are hidden on event request forms.
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
