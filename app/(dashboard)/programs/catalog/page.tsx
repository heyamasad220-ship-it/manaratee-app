"use client"

import { useState } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Eye } from "lucide-react"
import { cn } from "@/lib/utils"

// Mock data
const programs = [
  {
    id: "prog-1",
    name: "Youth Soccer League",
    department: "Events",
    ageGroup: "6-12 years",
    schedule: "Sat & Sun, 4:00 PM",
    duration: "12 weeks",
    fee: "$150",
    capacity: 80,
    enrolled: 64,
    instructor: "Coach Ahmad",
    status: "Active",
  },
  {
    id: "prog-2",
    name: "Taekwondo Classes",
    department: "Events",
    ageGroup: "8-16 years",
    schedule: "Mon, Wed, Fri 5:00 PM",
    duration: "Ongoing",
    fee: "$120/month",
    capacity: 50,
    enrolled: 45,
    instructor: "Master Kim",
    status: "Active",
  },
  {
    id: "prog-3",
    name: "Summer Camp 2026",
    department: "Community Outreach",
    ageGroup: "5-14 years",
    schedule: "Mon-Fri, 9:00 AM - 3:00 PM",
    duration: "8 weeks",
    fee: "$350/week",
    capacity: 150,
    enrolled: 120,
    instructor: "Various",
    status: "Open",
  },
  {
    id: "prog-4",
    name: "Adult Fitness Aerobics",
    department: "Events",
    ageGroup: "18+ years",
    schedule: "Tue & Thu, 6:30 PM",
    duration: "Ongoing",
    fee: "$80/month",
    capacity: 40,
    enrolled: 32,
    instructor: "Sarah Johnson",
    status: "Active",
  },
  {
    id: "prog-5",
    name: "After School Tutoring",
    department: "Education",
    ageGroup: "6-18 years",
    schedule: "Mon-Thu, 3:30 PM",
    duration: "Semester",
    fee: "$200/month",
    capacity: 30,
    enrolled: 28,
    instructor: "Various",
    status: "Active",
  },
  {
    id: "prog-6",
    name: "Weekend Quran Class",
    department: "Education",
    ageGroup: "All ages",
    schedule: "Sat & Sun, 10:00 AM",
    duration: "Ongoing",
    fee: "Free",
    capacity: 100,
    enrolled: 75,
    instructor: "Imam Hassan",
    status: "Active",
  },
  {
    id: "prog-7",
    name: "Basketball Training",
    department: "Events",
    ageGroup: "10-18 years",
    schedule: "Wed & Fri, 4:00 PM",
    duration: "16 weeks",
    fee: "$180",
    capacity: 30,
    enrolled: 22,
    instructor: "Coach Williams",
    status: "Active",
  },
  {
    id: "prog-8",
    name: "Art & Crafts Workshop",
    department: "Community Outreach",
    ageGroup: "5-12 years",
    schedule: "Saturday, 2:00 PM",
    duration: "8 weeks",
    fee: "$100",
    capacity: 20,
    enrolled: 18,
    instructor: "Ms. Rivera",
    status: "Active",
  },
]

const departments = ["All", "Administration", "Education", "Operations", "Technology", "Events", "Finance", "Marketing", "Community Outreach"]
const statuses = ["All", "Active", "Open", "Closed", "Draft"]

export default function ProgramsCatalogPage() {
  const [search, setSearch] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("All")
  const [statusFilter, setStatusFilter] = useState("All")
  const [showAddDialog, setShowAddDialog] = useState(false)

  const filteredPrograms = programs.filter((program) => {
    const matchesSearch = program.name.toLowerCase().includes(search.toLowerCase()) ||
      program.instructor.toLowerCase().includes(search.toLowerCase())
    const matchesDepartment = departmentFilter === "All" || program.department === departmentFilter
    const matchesStatus = statusFilter === "All" || program.status === statusFilter
    return matchesSearch && matchesDepartment && matchesStatus
  })

  return (
    <>
      <Header title="Programs" />
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Program Catalog</h2>
            <p className="text-sm text-muted-foreground">
              Manage all programs, classes, and activities
            </p>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Program
          </Button>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search programs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Programs Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Program Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Age Group</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Enrollment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPrograms.map((program) => (
                  <TableRow key={program.id}>
                    <TableCell>
                      <Link
                        href={`/programs/catalog/${program.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {program.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{program.instructor}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{program.department}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{program.ageGroup}</TableCell>
                    <TableCell className="text-muted-foreground">{program.schedule}</TableCell>
                    <TableCell className="font-medium">{program.fee}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              program.enrolled / program.capacity >= 0.9
                                ? "bg-red-500"
                                : program.enrolled / program.capacity >= 0.7
                                ? "bg-amber-500"
                                : "bg-green-500"
                            )}
                            style={{ width: `${(program.enrolled / program.capacity) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {program.enrolled}/{program.capacity}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          program.status === "Active"
                            ? "default"
                            : program.status === "Open"
                            ? "outline"
                            : "secondary"
                        }
                      >
                        {program.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/programs/catalog/${program.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit Program
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Add Program Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Program</DialogTitle>
            <DialogDescription>
              Add a new program, class, or activity to your catalog
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="program-name">Program Name</Label>
                <Input id="program-name" placeholder="e.g., Youth Soccer League" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="program-department">Department</Label>
                <Select>
                  <SelectTrigger id="program-department">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.slice(1).map((dept) => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="program-description">Description</Label>
              <Textarea
                id="program-description"
                placeholder="Describe the program..."
                rows={3}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="age-group">Age Group</Label>
                <Input id="age-group" placeholder="e.g., 6-12 years" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="capacity">Capacity</Label>
                <Input id="capacity" type="number" placeholder="Max participants" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="fee">Fee</Label>
                <Input id="fee" placeholder="e.g., $150" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="schedule">Schedule</Label>
                <Input id="schedule" placeholder="e.g., Mon & Wed, 4:00 PM" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="duration">Duration</Label>
                <Input id="duration" placeholder="e.g., 12 weeks" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="instructor">Instructor</Label>
                <Input id="instructor" placeholder="Instructor name" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="location">Location</Label>
                <Input id="location" placeholder="e.g., Field A, Gym" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowAddDialog(false)}>
              Create Program
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
