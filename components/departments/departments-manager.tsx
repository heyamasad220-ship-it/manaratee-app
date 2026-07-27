"use client"

import * as React from "react"
import Link from "next/link"
import { ImageIcon, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"

import {
  createDepartment,
  deleteDepartment,
  fetchDepartmentsWithProgramCounts,
  updateDepartment,
  updateDepartmentFlyer,
} from "@/lib/departments/department-actions"
import { workforceDepartmentDetailPath } from "@/lib/departments/department-paths"
import { YEAR_SEASON_LABEL_PLURAL } from "@/lib/programs/program-display-labels"
import { ProgramFlyerField } from "@/components/programs/edit/program-flyer-field"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type Department = {
  id: string
  name: string
  description: string | null
  color: string | null
  flyer_url: string | null
  programs_count?: number
}

const emptyDepartment = {
  id: "",
  name: "",
  description: "",
  color: "#3b82f6",
  flyerUrl: "",
}

export function DepartmentsManager() {
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [departments, setDepartments] = React.useState<Department[]>([])
  const [departmentDialogOpen, setDepartmentDialogOpen] = React.useState(false)
  const [flyerDialogOpen, setFlyerDialogOpen] = React.useState(false)
  const [flyerDepartment, setFlyerDepartment] = React.useState<Department | null>(null)
  const [flyerUrlDraft, setFlyerUrlDraft] = React.useState("")
  const [savingFlyer, setSavingFlyer] = React.useState(false)
  const [editingDepartment, setEditingDepartment] = React.useState(emptyDepartment)

  React.useEffect(() => {
    void loadDepartments()
  }, [])

  async function loadDepartments() {
    setLoading(true)

    try {
      const data = await fetchDepartmentsWithProgramCounts()
      setDepartments(data)
    } catch (error) {
      console.error("Load departments error:", error)
      setDepartments([])
    } finally {
      setLoading(false)
    }
  }

  function openAddDepartmentDialog() {
    setEditingDepartment(emptyDepartment)
    setDepartmentDialogOpen(true)
  }

  function openEditDepartmentDialog(department: Department) {
    setEditingDepartment({
      id: department.id,
      name: department.name,
      description: department.description || "",
      color: department.color || "#3b82f6",
      flyerUrl: department.flyer_url || "",
    })
    setDepartmentDialogOpen(true)
  }

  function openFlyerDialog(department: Department) {
    setFlyerDepartment(department)
    setFlyerUrlDraft(department.flyer_url || "")
    setFlyerDialogOpen(true)
  }

  async function handleSaveDepartment() {
    if (!editingDepartment.name.trim()) return

    setSaving(true)

    try {
      const payload = {
        name: editingDepartment.name.trim(),
        description: editingDepartment.description.trim() || undefined,
        color: editingDepartment.color || "#3b82f6",
        flyerUrl: editingDepartment.flyerUrl.trim() || null,
      }

      if (editingDepartment.id) {
        await updateDepartment({
          id: editingDepartment.id,
          ...payload,
        })
      } else {
        await createDepartment(payload)
      }

      setDepartmentDialogOpen(false)
      setEditingDepartment(emptyDepartment)
      await loadDepartments()
    } catch (error: unknown) {
      console.error("Save department error:", error)
      alert(error instanceof Error ? error.message : "Could not save department.")
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveFlyer() {
    if (!flyerDepartment) return

    setSavingFlyer(true)
    try {
      await updateDepartmentFlyer({
        id: flyerDepartment.id,
        flyerUrl: flyerUrlDraft.trim() || null,
      })
      setFlyerDialogOpen(false)
      setFlyerDepartment(null)
      setFlyerUrlDraft("")
      await loadDepartments()
    } catch (error: unknown) {
      console.error("Save department flyer error:", error)
      alert(error instanceof Error ? error.message : "Could not save flyer.")
    } finally {
      setSavingFlyer(false)
    }
  }

  async function handleDeleteDepartment(department: Department) {
    if ((department.programs_count || 0) > 0) {
      alert(
        "This department is used by programs. Move those programs first, then delete the department."
      )
      return
    }

    const confirmed = window.confirm("Delete this department?")
    if (!confirmed) return

    try {
      await deleteDepartment(department.id)
      await loadDepartments()
    } catch (error: unknown) {
      console.error("Delete department error:", error)
      alert(error instanceof Error ? error.message : "Could not delete department.")
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Departments</h2>
            <p className="text-sm text-muted-foreground">
              Manage departments for organizing programs and staff.
            </p>
          </div>

          <Button onClick={openAddDepartmentDialog}>
            <Plus className="mr-2 size-4" />
            Add Department
          </Button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading departments...</p>
        ) : departments.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No departments yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {departments.map((department) => {
              const color = department.color || "#3b82f6"
              const years = department.programs_count || 0
              return (
                <Card key={department.id} className="overflow-hidden border-border/80 shadow-sm">
                  <CardContent className="flex h-full flex-col gap-3 p-4">
                    <div className="flex gap-3">
                      <div
                        className={cn(
                          "relative aspect-square w-16 shrink-0 overflow-hidden rounded-lg sm:w-20"
                        )}
                        style={
                          department.flyer_url
                            ? undefined
                            : { backgroundColor: color }
                        }
                      >
                        {department.flyer_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={department.flyer_url}
                            alt={`${department.name} flyer`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <span className="text-xl font-semibold text-white/90">
                              {department.name.trim().charAt(0).toUpperCase() || "D"}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-block size-2.5 shrink-0 rounded-full border"
                                style={{ backgroundColor: color }}
                                title="Department color"
                              />
                              <Link
                                href={workforceDepartmentDetailPath(department.id)}
                                className="truncate text-base font-semibold leading-snug tracking-tight text-primary hover:underline"
                              >
                                {department.name}
                              </Link>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {years} {YEAR_SEASON_LABEL_PLURAL.toLowerCase()}
                            </p>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                aria-label={`${department.name} actions`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem
                                onClick={() => openEditDepartmentDialog(department)}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openFlyerDialog(department)}>
                                <ImageIcon className="mr-2 h-4 w-4" />
                                {department.flyer_url ? "Edit flyer" : "Upload flyer"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => void handleDeleteDepartment(department)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {department.description || "No description"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={departmentDialogOpen} onOpenChange={setDepartmentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDepartment.id ? "Edit Department" : "Add Department"}
            </DialogTitle>
            <DialogDescription>
              {editingDepartment.id ? "Update this department." : "Create a new department."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="department-name">Name</Label>
              <Input
                id="department-name"
                value={editingDepartment.name}
                onChange={(event) =>
                  setEditingDepartment({ ...editingDepartment, name: event.target.value })
                }
                placeholder="e.g., Youth Services"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="department-color">Color</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="department-color"
                  type="color"
                  className="h-10 w-20 cursor-pointer p-1"
                  value={editingDepartment.color}
                  onChange={(event) =>
                    setEditingDepartment({ ...editingDepartment, color: event.target.value })
                  }
                />
                <span className="text-sm text-muted-foreground">
                  Choose a color for the department
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="department-description">Description</Label>
              <Textarea
                id="department-description"
                value={editingDepartment.description}
                onChange={(event) =>
                  setEditingDepartment({
                    ...editingDepartment,
                    description: event.target.value,
                  })
                }
                placeholder="Brief description of this department"
                rows={2}
              />
            </div>

            <ProgramFlyerField
              programId={editingDepartment.id || "department-draft"}
              value={editingDepartment.flyerUrl}
              onValueChange={(url) =>
                setEditingDepartment({ ...editingDepartment, flyerUrl: url })
              }
              hideHiddenInput
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDepartmentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSaveDepartment()} disabled={saving}>
              {saving ? "Saving..." : editingDepartment.id ? "Save Changes" : "Add Department"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={flyerDialogOpen}
        onOpenChange={(open) => {
          setFlyerDialogOpen(open)
          if (!open) {
            setFlyerDepartment(null)
            setFlyerUrlDraft("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {flyerDepartment?.flyer_url ? "Edit flyer" : "Upload flyer"}
            </DialogTitle>
            <DialogDescription>
              {flyerDepartment
                ? `Flyer for ${flyerDepartment.name}. Shown on the department card.`
                : "Upload a department flyer."}
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {flyerDepartment ? (
              <ProgramFlyerField
                programId={flyerDepartment.id}
                value={flyerUrlDraft}
                onValueChange={setFlyerUrlDraft}
                hideHiddenInput
              />
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFlyerDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSaveFlyer()} disabled={savingFlyer}>
              {savingFlyer ? "Saving..." : "Save flyer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
