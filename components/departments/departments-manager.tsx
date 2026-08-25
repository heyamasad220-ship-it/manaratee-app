"use client"

import * as React from "react"
import Link from "next/link"
import { Plus } from "lucide-react"

import {
  createDepartment,
  fetchDepartmentsWithProgramCounts,
} from "@/lib/departments/department-actions"
import { workforceDepartmentDetailPath } from "@/lib/departments/department-paths"
import { YEAR_SEASON_LABEL_PLURAL } from "@/lib/programs/program-display-labels"
import { isRichTextEmpty, sanitizeRichTextHtml } from "@/lib/ui/rich-text"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RichTextEditor } from "@/components/ui/rich-text-editor"

type Department = {
  id: string
  name: string
  description: string | null
  color: string | null
  programs_count?: number
  director_name?: string | null
  employees_count?: number
}

const emptyDepartment = {
  name: "",
  description: "",
  color: "#3b82f6",
}

function departmentDescriptionPreview(html: string | null) {
  const sanitized = sanitizeRichTextHtml(html || "")
  if (isRichTextEmpty(sanitized)) return "No description"
  return sanitized
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function DepartmentsManager() {
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [departments, setDepartments] = React.useState<Department[]>([])
  const [departmentDialogOpen, setDepartmentDialogOpen] = React.useState(false)
  const [newDepartment, setNewDepartment] = React.useState(emptyDepartment)

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
    setNewDepartment(emptyDepartment)
    setDepartmentDialogOpen(true)
  }

  async function handleSaveDepartment() {
    if (!newDepartment.name.trim()) return

    setSaving(true)

    try {
      await createDepartment({
        name: newDepartment.name.trim(),
        description: newDepartment.description.trim() || undefined,
        color: newDepartment.color || "#3b82f6",
      })

      setDepartmentDialogOpen(false)
      setNewDepartment(emptyDepartment)
      await loadDepartments()
    } catch (error: unknown) {
      console.error("Save department error:", error)
      alert(error instanceof Error ? error.message : "Could not save department.")
    } finally {
      setSaving(false)
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
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading departments...
          </p>
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
              const employees = department.employees_count || 0
              return (
                <Link
                  key={department.id}
                  href={workforceDepartmentDetailPath(department.id)}
                  className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Card className="h-full overflow-hidden border-border/80 shadow-sm transition-colors hover:bg-muted/40">
                    <CardContent className="flex h-full flex-col gap-3 p-4">
                      <div className="flex gap-3">
                        <div
                          className="relative aspect-square w-16 shrink-0 overflow-hidden rounded-lg sm:w-20"
                          style={{ backgroundColor: color }}
                        >
                          <div className="flex h-full items-center justify-center">
                            <span className="text-xl font-semibold text-white/90">
                              {department.name.trim().charAt(0).toUpperCase() ||
                                "D"}
                            </span>
                          </div>
                        </div>

                        <div className="min-w-0 flex-1 space-y-1.5">
                          <p className="truncate text-base font-semibold leading-snug tracking-tight text-primary">
                            {department.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {years} {YEAR_SEASON_LABEL_PLURAL.toLowerCase()}
                          </p>
                          <dl className="space-y-0.5 text-sm">
                            <div className="flex gap-2">
                              <dt className="shrink-0 text-muted-foreground">
                                Director
                              </dt>
                              <dd className="min-w-0 truncate font-medium">
                                {department.director_name || "Not assigned"}
                              </dd>
                            </div>
                            <div className="flex gap-2">
                              <dt className="shrink-0 text-muted-foreground">
                                Employees
                              </dt>
                              <dd className="font-medium">{employees}</dd>
                            </div>
                          </dl>
                          <p className="line-clamp-2 text-sm text-muted-foreground">
                            {departmentDescriptionPreview(department.description)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={departmentDialogOpen} onOpenChange={setDepartmentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Department</DialogTitle>
            <DialogDescription>Create a new department.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="department-name">Name</Label>
              <Input
                id="department-name"
                value={newDepartment.name}
                onChange={(event) =>
                  setNewDepartment({ ...newDepartment, name: event.target.value })
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
                  value={newDepartment.color}
                  onChange={(event) =>
                    setNewDepartment({
                      ...newDepartment,
                      color: event.target.value,
                    })
                  }
                />
                <span className="text-sm text-muted-foreground">
                  Choose a color for the department
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Description</Label>
              <RichTextEditor
                value={newDepartment.description}
                onChange={(html) =>
                  setNewDepartment({
                    ...newDepartment,
                    description: html,
                  })
                }
                placeholder="Brief description of this department"
                minHeightClassName="min-h-[120px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDepartmentDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleSaveDepartment()} disabled={saving}>
              {saving ? "Saving..." : "Add Department"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
