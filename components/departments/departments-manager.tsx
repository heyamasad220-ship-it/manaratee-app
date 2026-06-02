"use client"

import * as React from "react"
import {
  createDepartment,
  deleteDepartment,
  fetchDepartmentsWithProgramCounts,
  updateDepartment,
} from "@/lib/departments/department-actions"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Pencil, Plus, Trash2 } from "lucide-react"

type Department = {
  id: string
  name: string
  description: string | null
  color: string | null
  programs_count?: number
}

const emptyDepartment = {
  id: "",
  name: "",
  description: "",
  color: "#3b82f6",
}

export function DepartmentsManager() {
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [departments, setDepartments] = React.useState<Department[]>([])
  const [departmentDialogOpen, setDepartmentDialogOpen] = React.useState(false)
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
    })
    setDepartmentDialogOpen(true)
  }

  async function handleSaveDepartment() {
    if (!editingDepartment.name.trim()) return

    setSaving(true)

    try {
      if (editingDepartment.id) {
        await updateDepartment({
          id: editingDepartment.id,
          name: editingDepartment.name.trim(),
          description: editingDepartment.description.trim() || undefined,
          color: editingDepartment.color || "#3b82f6",
        })
      } else {
        await createDepartment({
          name: editingDepartment.name.trim(),
          description: editingDepartment.description.trim() || undefined,
          color: editingDepartment.color || "#3b82f6",
        })
      }

      setDepartmentDialogOpen(false)
      setEditingDepartment(emptyDepartment)
      await loadDepartments()
    } catch (error: any) {
      console.error("Save department error:", error)
      alert(error?.message || "Could not save department.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteDepartment(department: Department) {
    if ((department.programs_count || 0) > 0) {
      alert("This department is used by programs. Move those programs first, then delete the department.")
      return
    }

    const confirmed = window.confirm("Delete this department?")
    if (!confirmed) return

    try {
      await deleteDepartment(department.id)
      await loadDepartments()
    } catch (error: any) {
      console.error("Delete department error:", error)
      alert(error?.message || "Could not delete department.")
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

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Color</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Programs</TableHead>
                  <TableHead className="w-[110px]" />
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Loading departments...
                    </TableCell>
                  </TableRow>
                ) : departments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No departments yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  departments.map((department) => (
                    <TableRow key={department.id}>
                      <TableCell>
                        <div
                          className="size-6 rounded-full border"
                          style={{ backgroundColor: department.color || "#3b82f6" }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{department.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {department.description || "-"}
                      </TableCell>
                      <TableCell>{department.programs_count || 0}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => openEditDepartmentDialog(department)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-red-600"
                            onClick={() => handleDeleteDepartment(department)}
                          >
                            <Trash2 className="size-4" />
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

      <Dialog open={departmentDialogOpen} onOpenChange={setDepartmentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDepartment.id ? "Edit Department" : "Add Department"}</DialogTitle>
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
                <span className="text-sm text-muted-foreground">Choose a color for the department</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="department-description">Description</Label>
              <Textarea
                id="department-description"
                value={editingDepartment.description}
                onChange={(event) =>
                  setEditingDepartment({ ...editingDepartment, description: event.target.value })
                }
                placeholder="Brief description of this department"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDepartmentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveDepartment} disabled={saving}>
              {saving ? "Saving..." : editingDepartment.id ? "Save Changes" : "Add Department"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
