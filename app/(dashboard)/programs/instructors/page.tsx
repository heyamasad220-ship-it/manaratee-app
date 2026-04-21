"use client"

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Mail, Phone, GraduationCap, Users } from "lucide-react"

// Mock data
const instructors = [
  {
    id: "inst-1",
    name: "Coach Ahmad",
    email: "ahmad@email.com",
    phone: "(555) 111-2222",
    specialty: "Soccer",
    programs: ["Youth Soccer League"],
    students: 64,
    status: "Active",
    hireDate: "Jan 2024",
  },
  {
    id: "inst-2",
    name: "Master Kim",
    email: "kim@email.com",
    phone: "(555) 222-3333",
    specialty: "Martial Arts",
    programs: ["Taekwondo Classes"],
    students: 45,
    status: "Active",
    hireDate: "Mar 2023",
  },
  {
    id: "inst-3",
    name: "Sarah Johnson",
    email: "sarah.j@email.com",
    phone: "(555) 333-4444",
    specialty: "Fitness",
    programs: ["Adult Fitness Aerobics"],
    students: 32,
    status: "Active",
    hireDate: "Jun 2024",
  },
  {
    id: "inst-4",
    name: "Imam Hassan",
    email: "hassan@email.com",
    phone: "(555) 444-5555",
    specialty: "Religious Studies",
    programs: ["Weekend Quran Class"],
    students: 75,
    status: "Active",
    hireDate: "Jan 2022",
  },
  {
    id: "inst-5",
    name: "Coach Williams",
    email: "williams@email.com",
    phone: "(555) 555-6666",
    specialty: "Basketball",
    programs: ["Basketball Training"],
    students: 22,
    status: "Active",
    hireDate: "Sep 2024",
  },
  {
    id: "inst-6",
    name: "Ms. Rivera",
    email: "rivera@email.com",
    phone: "(555) 666-7777",
    specialty: "Arts",
    programs: ["Art & Crafts Workshop"],
    students: 18,
    status: "Active",
    hireDate: "Feb 2025",
  },
  {
    id: "inst-7",
    name: "Dr. Thompson",
    email: "thompson@email.com",
    phone: "(555) 777-8888",
    specialty: "Education",
    programs: ["After School Tutoring"],
    students: 28,
    status: "On Leave",
    hireDate: "Aug 2023",
  },
]

const specialties = ["All", "Soccer", "Martial Arts", "Fitness", "Religious Studies", "Basketball", "Arts", "Education"]
const statuses = ["All", "Active", "On Leave", "Inactive"]

export default function ProgramsInstructorsPage() {
  const [search, setSearch] = useState("")
  const [specialtyFilter, setSpecialtyFilter] = useState("All")
  const [statusFilter, setStatusFilter] = useState("All")
  const [showAddDialog, setShowAddDialog] = useState(false)

  const filteredInstructors = instructors.filter((inst) => {
    const matchesSearch = inst.name.toLowerCase().includes(search.toLowerCase()) ||
      inst.email.toLowerCase().includes(search.toLowerCase())
    const matchesSpecialty = specialtyFilter === "All" || inst.specialty === specialtyFilter
    const matchesStatus = statusFilter === "All" || inst.status === statusFilter
    return matchesSearch && matchesSpecialty && matchesStatus
  })

  const totalStudents = instructors.reduce((sum, inst) => sum + inst.students, 0)

  return (
    <>
      <Header title="Programs" />
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Instructors</h2>
            <p className="text-sm text-muted-foreground">
              Manage program instructors and coaches
            </p>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Instructor
          </Button>
        </div>

        {/* Stats */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-full bg-blue-100 p-3 text-blue-600">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Instructors</p>
                <p className="text-2xl font-bold text-foreground">{instructors.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-full bg-green-100 p-3 text-green-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Students</p>
                <p className="text-2xl font-bold text-foreground">{totalStudents}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-full bg-amber-100 p-3 text-amber-600">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Programs</p>
                <p className="text-2xl font-bold text-foreground">8</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search instructors..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Specialty" />
                </SelectTrigger>
                <SelectContent>
                  {specialties.map((spec) => (
                    <SelectItem key={spec} value={spec}>{spec}</SelectItem>
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

        {/* Instructors Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Instructor</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Specialty</TableHead>
                  <TableHead>Programs</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInstructors.map((instructor) => (
                  <TableRow key={instructor.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {instructor.name.split(" ").map(n => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">{instructor.name}</p>
                          <p className="text-xs text-muted-foreground">Since {instructor.hireDate}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center gap-1 text-sm">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          {instructor.email}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {instructor.phone}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{instructor.specialty}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {instructor.programs.map((prog) => (
                          <span key={prog} className="text-sm text-foreground">{prog}</span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{instructor.students}</TableCell>
                    <TableCell>
                      <Badge
                        variant={instructor.status === "Active" ? "default" : "secondary"}
                      >
                        {instructor.status}
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
                          <DropdownMenuItem>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Mail className="mr-2 h-4 w-4" />
                            Send Email
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove
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

      {/* Add Instructor Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Instructor</DialogTitle>
            <DialogDescription>
              Add a new instructor to your programs
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="instructor-name">Full Name</Label>
              <Input id="instructor-name" placeholder="Enter full name" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="instructor-email">Email</Label>
                <Input id="instructor-email" type="email" placeholder="email@example.com" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="instructor-phone">Phone</Label>
                <Input id="instructor-phone" placeholder="(555) 000-0000" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="instructor-specialty">Specialty</Label>
              <Select>
                <SelectTrigger id="instructor-specialty">
                  <SelectValue placeholder="Select specialty" />
                </SelectTrigger>
                <SelectContent>
                  {specialties.slice(1).map((spec) => (
                    <SelectItem key={spec} value={spec}>{spec}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="instructor-programs">Assign to Programs</Label>
              <Select>
                <SelectTrigger id="instructor-programs">
                  <SelectValue placeholder="Select programs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="soccer">Youth Soccer League</SelectItem>
                  <SelectItem value="taekwondo">Taekwondo Classes</SelectItem>
                  <SelectItem value="fitness">Adult Fitness Aerobics</SelectItem>
                  <SelectItem value="quran">Weekend Quran Class</SelectItem>
                  <SelectItem value="basketball">Basketball Training</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowAddDialog(false)}>
              Add Instructor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
