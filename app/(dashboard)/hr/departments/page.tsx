"use client"

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Pencil, Trash2, Users, Search } from "lucide-react"

const mockDepartments = [
  { id: "d-1", name: "Administration", head: "Ahmad Hassan", employees: 8, budget: "$120,000", status: "Active" },
  { id: "d-2", name: "Education", head: "Fatima Ali", employees: 12, budget: "$180,000", status: "Active" },
  { id: "d-3", name: "Operations", head: "Omar Khan", employees: 6, budget: "$95,000", status: "Active" },
  { id: "d-4", name: "Technology", head: "Sarah Ahmed", employees: 4, budget: "$150,000", status: "Active" },
  { id: "d-5", name: "Events", head: "Yusuf Ibrahim", employees: 5, budget: "$85,000", status: "Active" },
  { id: "d-6", name: "Finance", head: "Aisha Mohammed", employees: 3, budget: "$75,000", status: "Active" },
  { id: "d-7", name: "Marketing", head: "Khalid Rahman", employees: 4, budget: "$60,000", status: "Active" },
  { id: "d-8", name: "Community Outreach", head: "Mariam Hussain", employees: 6, budget: "$70,000", status: "Active" },
]

export default function DepartmentsPage() {
  console.log("[v0] DepartmentsPage rendering")
  const [departments, setDepartments] = useState(mockDepartments)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingDept, setEditingDept] = useState<typeof mockDepartments[0] | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  console.log("[v0] departments:", departments)

  const filteredDepartments = departments.filter((dept) =>
    dept.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    dept.head.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalEmployees = departments.reduce((sum, d) => sum + d.employees, 0)
  console.log("[v0] totalEmployees:", totalEmployees)

  return (
    <>
      <Header title="Departments" />
      <div className="p-6">
        <div className="flex flex-col gap-6">
          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Departments</CardDescription>
                <CardTitle className="text-2xl">{departments.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Employees</CardDescription>
                <CardTitle className="text-2xl">{totalEmployees}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Avg. Department Size</CardDescription>
                <CardTitle className="text-2xl">{Math.round(totalEmployees / departments.length)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Active Departments</CardDescription>
                <CardTitle className="text-2xl">{departments.filter(d => d.status === "Active").length}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Department List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All Departments</CardTitle>
                  <CardDescription>Manage organizational departments and their structure</CardDescription>
                </div>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Department
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="relative w-[300px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search departments..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department</TableHead>
                    <TableHead>Department Head</TableHead>
                    <TableHead>Employees</TableHead>
                    <TableHead>Annual Budget</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDepartments.map((dept) => (
                    <TableRow key={dept.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                            <Users className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-medium">{dept.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{dept.head}</TableCell>
                      <TableCell>{dept.employees}</TableCell>
                      <TableCell>{dept.budget}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          {dept.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setEditingDept(dept)
                              setShowAddDialog(true)
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-red-600"
                            onClick={() => setDepartments(departments.filter((d) => d.id !== dept.id))}
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
      </div>

      {/* Add/Edit Department Dialog */}
      <Dialog
        open={showAddDialog}
        onOpenChange={(open) => {
          setShowAddDialog(open)
          if (!open) setEditingDept(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDept ? "Edit Department" : "Add Department"}</DialogTitle>
            <DialogDescription>
              {editingDept ? "Update department details" : "Create a new department"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="dept-name">Department Name</Label>
              <Input
                id="dept-name"
                placeholder="e.g., Marketing"
                defaultValue={editingDept?.name}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="dept-head">Department Head</Label>
              <Input
                id="dept-head"
                placeholder="Select or enter name"
                defaultValue={editingDept?.head}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="dept-budget">Annual Budget</Label>
              <Input
                id="dept-budget"
                placeholder="$0"
                defaultValue={editingDept?.budget}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="dept-status">Status</Label>
              <Select defaultValue={editingDept?.status || "Active"}>
                <SelectTrigger id="dept-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddDialog(false)
              setEditingDept(null)
            }}>
              Cancel
            </Button>
            <Button onClick={() => {
              setShowAddDialog(false)
              setEditingDept(null)
            }}>
              {editingDept ? "Save Changes" : "Add Department"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
