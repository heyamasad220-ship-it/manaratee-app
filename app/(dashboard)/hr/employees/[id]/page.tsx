"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, User, Pencil, Save, X, Mail, Phone, Calendar, Briefcase, Building } from "lucide-react"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type EmployeeStatus = "Active" | "Inactive" | "On Leave"
type EmployeeType = "Full-Time" | "Part-Time" | "Contract" | "Intern"

interface Employee {
  id: string
  name: string
  email: string
  phone: string
  title: string
  department: string
  type: EmployeeType
  status: EmployeeStatus
  startDate: string
  manager: string
  address: string
  city: string
  state: string
  zip: string
  emergencyContact: string
  emergencyPhone: string
  notes: string
}

const mockEmployees: Record<string, Employee> = {
  "emp-001": {
    id: "emp-001",
    name: "Sarah Mitchell",
    email: "sarah.mitchell@organization.org",
    phone: "+1 (555) 111-2222",
    title: "Program Director",
    department: "Administration",
    type: "Full-Time",
    status: "Active",
    startDate: "2021-03-15",
    manager: "Executive Director",
    address: "123 Main Street",
    city: "Springfield",
    state: "IL",
    zip: "62701",
    emergencyContact: "John Mitchell",
    emergencyPhone: "+1 (555) 111-3333",
    notes: "Oversees all program operations. Has 10+ years of nonprofit experience.",
  },
  "emp-002": {
    id: "emp-002",
    name: "James Okafor",
    email: "james.okafor@organization.org",
    phone: "+1 (555) 222-3333",
    title: "Lead Instructor",
    department: "Education",
    type: "Full-Time",
    status: "Active",
    startDate: "2022-01-10",
    manager: "Sarah Mitchell",
    address: "456 Oak Avenue",
    city: "Springfield",
    state: "IL",
    zip: "62702",
    emergencyContact: "Grace Okafor",
    emergencyPhone: "+1 (555) 222-4444",
    notes: "Specialized in STEM education. Certified teacher.",
  },
  "emp-003": {
    id: "emp-003",
    name: "Maria Gonzalez",
    email: "maria.gonzalez@organization.org",
    phone: "+1 (555) 333-4444",
    title: "Office Manager",
    department: "Operations",
    type: "Full-Time",
    status: "Active",
    startDate: "2020-06-01",
    manager: "Sarah Mitchell",
    address: "789 Elm Street",
    city: "Springfield",
    state: "IL",
    zip: "62703",
    emergencyContact: "Carlos Gonzalez",
    emergencyPhone: "+1 (555) 333-5555",
    notes: "Manages day-to-day office operations. Bilingual (English/Spanish).",
  },
  "emp-004": {
    id: "emp-004",
    name: "Kevin Park",
    email: "kevin.park@organization.org",
    phone: "+1 (555) 444-5555",
    title: "IT Support Specialist",
    department: "Technology",
    type: "Contract",
    status: "Active",
    startDate: "2023-09-01",
    manager: "Maria Gonzalez",
    address: "101 Tech Lane",
    city: "Chicago",
    state: "IL",
    zip: "60601",
    emergencyContact: "Susan Park",
    emergencyPhone: "+1 (555) 444-6666",
    notes: "Contracted through Tech Solutions Inc. Handles all IT support.",
  },
  "emp-005": {
    id: "emp-005",
    name: "Aisha Rahman",
    email: "aisha.rahman@organization.org",
    phone: "+1 (555) 555-6666",
    title: "Event Coordinator",
    department: "Events",
    type: "Part-Time",
    status: "Active",
    startDate: "2023-03-15",
    manager: "Sarah Mitchell",
    address: "202 Festival Road",
    city: "Springfield",
    state: "IL",
    zip: "62704",
    emergencyContact: "Ahmed Rahman",
    emergencyPhone: "+1 (555) 555-7777",
    notes: "Coordinates community events and fundraisers. Works 25 hours/week.",
  },
  "emp-006": {
    id: "emp-006",
    name: "David Chen",
    email: "david.chen@organization.org",
    phone: "+1 (555) 666-7777",
    title: "Facilities Manager",
    department: "Operations",
    type: "Full-Time",
    status: "On Leave",
    startDate: "2019-11-01",
    manager: "Maria Gonzalez",
    address: "303 Building Way",
    city: "Springfield",
    state: "IL",
    zip: "62705",
    emergencyContact: "Linda Chen",
    emergencyPhone: "+1 (555) 666-8888",
    notes: "Currently on medical leave. Expected return: April 2026.",
  },
  "emp-007": {
    id: "emp-007",
    name: "Jessica Taylor",
    email: "jessica.taylor@organization.org",
    phone: "+1 (555) 777-8888",
    title: "Marketing Associate",
    department: "Marketing",
    type: "Intern",
    status: "Active",
    startDate: "2026-01-15",
    manager: "Sarah Mitchell",
    address: "404 College Drive",
    city: "Champaign",
    state: "IL",
    zip: "61820",
    emergencyContact: "Robert Taylor",
    emergencyPhone: "+1 (555) 777-9999",
    notes: "Marketing intern from University of Illinois. Internship ends May 2026.",
  },
  "emp-008": {
    id: "emp-008",
    name: "Robert Kim",
    email: "robert.kim@organization.org",
    phone: "+1 (555) 888-9999",
    title: "Finance Officer",
    department: "Finance",
    type: "Full-Time",
    status: "Inactive",
    startDate: "2018-04-01",
    manager: "Executive Director",
    address: "505 Finance Street",
    city: "Springfield",
    state: "IL",
    zip: "62706",
    emergencyContact: "Jennifer Kim",
    emergencyPhone: "+1 (555) 888-0000",
    notes: "Resigned effective February 2026. Position being filled.",
  },
}

const statusStyles: Record<EmployeeStatus, string> = {
  Active: "bg-emerald-100 text-emerald-700",
  Inactive: "bg-muted text-muted-foreground",
  "On Leave": "bg-amber-100 text-amber-700",
}

const typeStyles: Record<EmployeeType, string> = {
  "Full-Time": "bg-blue-100 text-blue-700",
  "Part-Time": "bg-violet-100 text-violet-700",
  Contract: "bg-orange-100 text-orange-700",
  Intern: "bg-teal-100 text-teal-700",
}

export default function EmployeeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const empId = params.id as string
  
  const initialEmp = mockEmployees[empId]
  const [isEditing, setIsEditing] = useState(false)
  const [emp, setEmp] = useState<Employee | null>(initialEmp || null)

  if (!emp) {
    return (
      <>
        <Header title="Employee Not Found" />
        <div className="flex flex-col items-center justify-center gap-4 p-12">
          <User className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Employee not found</h2>
          <p className="text-muted-foreground">The employee you're looking for doesn't exist.</p>
          <Button asChild>
            <Link href="/people/employees">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Employees
            </Link>
          </Button>
        </div>
      </>
    )
  }

  function handleSave() {
    // In a real app, this would save to the database
    setIsEditing(false)
  }

  function handleCancel() {
    setEmp(initialEmp)
    setIsEditing(false)
  }

  const initials = emp.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()

  return (
    <>
      <Header title={emp.name} />
      <div className="flex flex-col gap-6 p-6">
        {/* Back link and actions */}
        <div className="flex items-center justify-between">
          <Link
href="/hr/employees"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to Employees
          </Link>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  <X className="mr-1.5 h-4 w-4" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave}>
                  <Save className="mr-1.5 h-4 w-4" />
                  Save Changes
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setIsEditing(true)}>
                <Pencil className="mr-1.5 h-4 w-4" />
                Edit Employee
              </Button>
            )}
          </div>
        </div>

        {/* Employee header */}
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="bg-primary/10 text-lg text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{emp.name}</h1>
              <Badge className={statusStyles[emp.status]}>{emp.status}</Badge>
              <Badge className={typeStyles[emp.type]}>{emp.type}</Badge>
            </div>
            <p className="mt-1 text-muted-foreground">{emp.title} - {emp.department}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Info */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Employment Details</CardTitle>
                <CardDescription>Job and department information</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="title">Job Title</Label>
                    {isEditing ? (
                      <Input
                        id="title"
                        value={emp.title}
                        onChange={(e) => setEmp({ ...emp, title: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm text-foreground">{emp.title}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="department">Department</Label>
                    {isEditing ? (
                      <Select
                        value={emp.department}
                        onValueChange={(v) => setEmp({ ...emp, department: v })}
                      >
                        <SelectTrigger id="department">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Administration">Administration</SelectItem>
                          <SelectItem value="Education">Education</SelectItem>
                          <SelectItem value="Operations">Operations</SelectItem>
                          <SelectItem value="Technology">Technology</SelectItem>
                          <SelectItem value="Events">Events</SelectItem>
                          <SelectItem value="Marketing">Marketing</SelectItem>
                          <SelectItem value="Finance">Finance</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm text-foreground">{emp.department}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="type">Employment Type</Label>
                    {isEditing ? (
                      <Select
                        value={emp.type}
                        onValueChange={(v) => setEmp({ ...emp, type: v as EmployeeType })}
                      >
                        <SelectTrigger id="type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Full-Time">Full-Time</SelectItem>
                          <SelectItem value="Part-Time">Part-Time</SelectItem>
                          <SelectItem value="Contract">Contract</SelectItem>
                          <SelectItem value="Intern">Intern</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge className={typeStyles[emp.type]}>{emp.type}</Badge>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="status">Status</Label>
                    {isEditing ? (
                      <Select
                        value={emp.status}
                        onValueChange={(v) => setEmp({ ...emp, status: v as EmployeeStatus })}
                      >
                        <SelectTrigger id="status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Inactive">Inactive</SelectItem>
                          <SelectItem value="On Leave">On Leave</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge className={statusStyles[emp.status]}>{emp.status}</Badge>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="manager">Reports To</Label>
                    {isEditing ? (
                      <Input
                        id="manager"
                        value={emp.manager}
                        onChange={(e) => setEmp({ ...emp, manager: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm text-foreground">{emp.manager}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    {isEditing ? (
                      <Input
                        id="startDate"
                        type="date"
                        value={emp.startDate}
                        onChange={(e) => setEmp({ ...emp, startDate: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm text-foreground">
                        {new Date(emp.startDate).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="flex flex-col gap-2">
                  <Label htmlFor="notes">Notes</Label>
                  {isEditing ? (
                    <Textarea
                      id="notes"
                      value={emp.notes}
                      onChange={(e) => setEmp({ ...emp, notes: e.target.value })}
                      rows={3}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">{emp.notes || "No notes"}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
                <CardDescription>Personal contact details</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="email">Email</Label>
                    {isEditing ? (
                      <Input
                        id="email"
                        type="email"
                        value={emp.email}
                        onChange={(e) => setEmp({ ...emp, email: e.target.value })}
                      />
                    ) : (
                      <a href={`mailto:${emp.email}`} className="text-sm text-primary hover:underline">
                        {emp.email}
                      </a>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="phone">Phone</Label>
                    {isEditing ? (
                      <Input
                        id="phone"
                        value={emp.phone}
                        onChange={(e) => setEmp({ ...emp, phone: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm text-foreground">{emp.phone}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Address</CardTitle>
                <CardDescription>Home address</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <Label htmlFor="address">Street Address</Label>
                    {isEditing ? (
                      <Input
                        id="address"
                        value={emp.address}
                        onChange={(e) => setEmp({ ...emp, address: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm text-foreground">{emp.address}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="city">City</Label>
                    {isEditing ? (
                      <Input
                        id="city"
                        value={emp.city}
                        onChange={(e) => setEmp({ ...emp, city: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm text-foreground">{emp.city}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="state">State</Label>
                      {isEditing ? (
                        <Input
                          id="state"
                          value={emp.state}
                          onChange={(e) => setEmp({ ...emp, state: e.target.value })}
                        />
                      ) : (
                        <p className="text-sm text-foreground">{emp.state}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="zip">ZIP Code</Label>
                      {isEditing ? (
                        <Input
                          id="zip"
                          value={emp.zip}
                          onChange={(e) => setEmp({ ...emp, zip: e.target.value })}
                        />
                      ) : (
                        <p className="text-sm text-foreground">{emp.zip}</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Emergency Contact</CardTitle>
                <CardDescription>Emergency contact information</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="emergencyContact">Contact Name</Label>
                    {isEditing ? (
                      <Input
                        id="emergencyContact"
                        value={emp.emergencyContact}
                        onChange={(e) => setEmp({ ...emp, emergencyContact: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm text-foreground">{emp.emergencyContact}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="emergencyPhone">Contact Phone</Label>
                    {isEditing ? (
                      <Input
                        id="emergencyPhone"
                        value={emp.emergencyPhone}
                        onChange={(e) => setEmp({ ...emp, emergencyPhone: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm text-foreground">{emp.emergencyPhone}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Info</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Start Date</p>
                    <p className="text-sm font-medium">
                      {new Date(emp.startDate).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <Building className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Department</p>
                    <p className="text-sm font-medium">{emp.department}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Reports To</p>
                    <p className="text-sm font-medium">{emp.manager}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm font-medium">{emp.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="text-sm font-medium">{emp.phone}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
