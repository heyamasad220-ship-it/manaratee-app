"use client"

import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import { Header } from "@/components/layout/header"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Search,
  Calendar,
  UserPlus,
  Users,
  Briefcase,
  Shield,
  MoreHorizontal,
  Pencil,
  Trash2,
  GraduationCap,
  FileText,
  Banknote,
  Timer,
  FolderOpen,
  CircleDollarSign,
  AlertCircle,
  Upload,
  Download,
  Eye,
  CheckCircle2,
  XCircle,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type StaffType = "instructor" | "assistant" | "volunteer"
type StaffStatus = "active" | "inactive" | "on_leave" | "pending"
type BackgroundCheckStatus = "cleared" | "pending" | "expired" | "not_started"

type Department = {
  id: string
  name: string
}

type Program = {
  id: string
  name: string
  department_id: string | null
  organization_id: string
}

type StaffMember = {
  id: string
  organization_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  staff_type: StaffType
  status: StaffStatus
  position: string | null
  hire_date: string | null
  background_check_status?: BackgroundCheckStatus
  assigned_programs: string[]
}

type StaffAssignment = {
  id: string
  organization_id: string
  staff_id: string
  program_id: string
  role: StaffType
  start_date: string | null
  end_date: string | null
  schedule: string | null
  notes: string | null
  staff_name: string
  staff_email: string | null
  program_name: string
  department_id: string | null
}

type StaffDocumentStatus = "verified" | "pending" | "missing" | "expired"

type StaffDocument = {
  id: string
  staff_name: string
  staff_email: string | null
  document_type: string
  status: StaffDocumentStatus
  uploaded_at: string | null
  expires_at: string | null
}

export function InstructorsClient({
  organizationId,
}: {
  organizationId: string | null
}) {
  const supabase = createClient()

  const [activeTab, setActiveTab] = useState("overview")
  const [loading, setLoading] = useState(true)
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [assignments, setAssignments] = useState<StaffAssignment[]>([])
  const [documents, setDocuments] = useState<StaffDocument[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [programs, setPrograms] = useState<Program[]>([])

  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [documentSearchQuery, setDocumentSearchQuery] = useState("")
  const [documentStatusFilter, setDocumentStatusFilter] = useState("all")
  const [documentTypeFilter, setDocumentTypeFilter] = useState("all")

  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false)
  const [isAddAssignmentOpen, setIsAddAssignmentOpen] = useState(false)
  const [isEditStaffOpen, setIsEditStaffOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)

  const [newStaff, setNewStaff] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    staff_type: "instructor" as StaffType,
    status: "active" as StaffStatus,
    position: "",
    hire_date: "",
  })

  const [newAssignment, setNewAssignment] = useState({
    staff_id: "",
    program_id: "",
    role: "instructor" as StaffType,
    start_date: "",
    end_date: "",
    start_time: "",
    end_time: "",
    schedule: "",
    notes: "",
  })

  useEffect(() => {
    void fetchPageData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  async function fetchPageData() {
    if (!organizationId) {
      setStaff([])
      setAssignments([])
      setDocuments([])
      setPrograms([])
      setDepartments([])
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const { data: departmentsData, error: departmentsError } = await supabase
        .from("departments")
        .select("id, name")
        .eq("organization_id", organizationId)
        .order("name")

      if (departmentsError) throw departmentsError
      setDepartments((departmentsData || []) as Department[])

      const { data: programsData, error: programsError } = await supabase
        .from("programs")
        .select("id, name, department_id, organization_id")
        .eq("organization_id", organizationId)
        .order("name")

      if (programsError) throw programsError
      setPrograms((programsData || []) as Program[])

      const { data: staffData, error: staffError } = await supabase
        .from("staff")
        .select("*")
        .eq("organization_id", organizationId)
        .order("last_name")

      if (staffError) throw staffError

      const { data: assignmentData, error: assignmentError } = await supabase
        .from("staff_assignments")
        .select(`
          id,
          organization_id,
          staff_id,
          program_id,
          role,
          start_date,
          end_date,
          schedule,
          notes,
          staff:staff_id (
            first_name,
            last_name,
            email
          ),
          program:program_id (
            name,
            department_id
          )
        `)
        .eq("organization_id", organizationId)

      if (assignmentError) throw assignmentError

      let formattedDocuments: StaffDocument[] = []

      const { data: documentsData, error: documentsError } = await supabase
        .from("staff_documents")
        .select(`
          id,
          staff_id,
          document_type,
          status,
          uploaded_at,
          expires_at,
          staff:staff_id (
            first_name,
            last_name,
            email
          )
        `)
        .eq("organization_id", organizationId)

      if (!documentsError) {
        formattedDocuments = (documentsData || []).map((item: any) => ({
          id: item.id,
          staff_name: `${item.staff?.first_name || ""} ${item.staff?.last_name || ""}`.trim(),
          staff_email: item.staff?.email || null,
          document_type: item.document_type || "Document",
          status: item.status || "pending",
          uploaded_at: item.uploaded_at || null,
          expires_at: item.expires_at || null,
        }))
      } else if (documentsError.code !== "42P01" && documentsError.code !== "42703") {
        console.warn("Staff documents could not be loaded:", documentsError.message)
      }

      const formattedAssignments: StaffAssignment[] = (assignmentData || []).map((item: any) => ({
        id: item.id,
        organization_id: item.organization_id,
        staff_id: item.staff_id,
        program_id: item.program_id,
        role: item.role || "instructor",
        start_date: item.start_date,
        end_date: item.end_date,
        schedule: item.schedule,
        notes: item.notes,
        staff_name: `${item.staff?.first_name || ""} ${item.staff?.last_name || ""}`.trim(),
        staff_email: item.staff?.email || null,
        program_name: item.program?.name || "Unknown Program",
        department_id: item.program?.department_id || null,
      }))

      const staffWithPrograms: StaffMember[] = (staffData || []).map((person: any) => ({
        id: person.id,
        organization_id: person.organization_id,
        first_name: person.first_name,
        last_name: person.last_name,
        email: person.email,
        phone: person.phone,
        staff_type: person.staff_type || "instructor",
        status: person.status || "active",
        position: person.position,
        hire_date: person.hire_date,
        background_check_status: person.background_check_status || "not_started",
        assigned_programs: formattedAssignments
          .filter((assignment) => assignment.staff_id === person.id)
          .map((assignment) => assignment.program_name),
      }))

      setStaff(staffWithPrograms)
      setAssignments(formattedAssignments)
      setDocuments(formattedDocuments)
    } catch (error: any) {
      console.error("Staff page error:", error)
      alert(error?.message || "Something went wrong while loading staff data.")
    } finally {
      setLoading(false)
    }
  }

  async function handleAddStaff() {
    if (!organizationId || !newStaff.first_name || !newStaff.last_name) return

    const { error } = await supabase.from("staff").insert({
      organization_id: organizationId,
      first_name: newStaff.first_name,
      last_name: newStaff.last_name,
      email: newStaff.email || null,
      phone: newStaff.phone || null,
      staff_type: newStaff.staff_type,
      status: newStaff.status,
      position: newStaff.position || null,
      hire_date: newStaff.hire_date || null,
    })

    if (error) {
      console.error("Add staff error:", error)
      alert(error.message)
      return
    }

    setNewStaff({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      staff_type: "instructor",
      status: "active",
      position: "",
      hire_date: "",
    })

    setIsAddStaffOpen(false)
    await fetchPageData()
  }

  async function handleUpdateStaff() {
    if (!organizationId || !editingStaff) return

    const { error } = await supabase
      .from("staff")
      .update({
        first_name: editingStaff.first_name,
        last_name: editingStaff.last_name,
        email: editingStaff.email || null,
        phone: editingStaff.phone || null,
        staff_type: editingStaff.staff_type,
        status: editingStaff.status,
        position: editingStaff.position || null,
        hire_date: editingStaff.hire_date || null,
      })
      .eq("id", editingStaff.id)
      .eq("organization_id", organizationId)

    if (error) {
      console.error("Update staff error:", error)
      alert(error.message)
      return
    }

    setIsEditStaffOpen(false)
    setEditingStaff(null)
    await fetchPageData()
  }

  async function handleDeleteStaff(id: string) {
    if (!organizationId) return

    const confirmed = window.confirm("Delete this staff member? This cannot be undone.")
    if (!confirmed) return

    const { error } = await supabase
      .from("staff")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId)

    if (error) {
      console.error("Delete staff error:", error)
      alert(error.message)
      return
    }

    await fetchPageData()
  }

  async function handleAddAssignment() {
    if (!organizationId || !newAssignment.staff_id || !newAssignment.program_id) return

    const { error } = await supabase.from("staff_assignments").insert({
      organization_id: organizationId,
      staff_id: newAssignment.staff_id,
      program_id: newAssignment.program_id,
      role: newAssignment.role,
      start_date: newAssignment.start_date || null,
      end_date: newAssignment.end_date || null,
      schedule:
        newAssignment.start_date && newAssignment.start_time && newAssignment.end_time
          ? `${newAssignment.start_date} ${newAssignment.start_time} - ${newAssignment.end_time}`
          : null,
      notes: newAssignment.notes || null,
    })

    if (error) {
      console.error("Add assignment error:", error)
      alert(error.message)
      return
    }
    setNewAssignment({
      staff_id: "",
      program_id: "",
      role: "instructor",
      start_date: "",
      end_date: "",
      start_time: "",
      end_time: "",
      schedule: "",
      notes: "",
    })

    setIsAddAssignmentOpen(false)
    await fetchPageData()
  }

  async function handleDeleteAssignment(id: string) {
    const { error } = await supabase.from("staff_assignments").delete().eq("id", id)

    if (error) {
      console.error("Delete assignment error:", error)
      alert(error.message)
      return
    }

    await fetchPageData()
  }

  const stats = useMemo(() => {
    return {
      total: staff.length,
      active: staff.filter((person) => person.status === "active").length,
      instructors: staff.filter((person) => person.staff_type === "instructor").length,
      assistants: staff.filter((person) => person.staff_type === "assistant").length,
      volunteers: staff.filter((person) => person.staff_type === "volunteer").length,
      expiredCertifications: 0,
      pendingBgChecks: staff.filter(
        (person) =>
          person.background_check_status === "pending" ||
          person.background_check_status === "not_started"
      ).length,
    }
  }, [staff])

  const filteredStaff = useMemo(() => {
    return staff.filter((person) => {
      const fullName = `${person.first_name} ${person.last_name}`.toLowerCase()
      const search = searchQuery.toLowerCase()

      const matchesSearch =
        fullName.includes(search) ||
        person.email?.toLowerCase().includes(search) ||
        person.position?.toLowerCase().includes(search)

      const matchesType = typeFilter === "all" || person.staff_type === typeFilter
      const matchesStatus = statusFilter === "all" || person.status === statusFilter

      const personAssignments = assignments.filter((assignment) => assignment.staff_id === person.id)
      const matchesDepartment =
        departmentFilter === "all" ||
        personAssignments.some((assignment) => assignment.department_id === departmentFilter)

      return Boolean(matchesSearch && matchesType && matchesStatus && matchesDepartment)
    })
  }, [staff, assignments, searchQuery, typeFilter, statusFilter, departmentFilter])

  const assignmentStats = useMemo(() => {
    return {
      total: assignments.length,
      instructors: assignments.filter((assignment) => assignment.role === "instructor").length,
      assistants: assignments.filter((assignment) => assignment.role === "assistant").length,
      volunteers: assignments.filter((assignment) => assignment.role === "volunteer").length,
      programsCovered: new Set(assignments.map((assignment) => assignment.program_id)).size,
    }
  }, [assignments])

  const documentStats = useMemo(() => {
    return {
      total: documents.length,
      verified: documents.filter((document) => document.status === "verified").length,
      pending: documents.filter((document) => document.status === "pending").length,
      missing: documents.filter((document) => document.status === "missing").length,
      expired: documents.filter((document) => document.status === "expired").length,
    }
  }, [documents])

  const documentTypes = useMemo(() => {
    return Array.from(new Set(documents.map((document) => document.document_type))).sort()
  }, [documents])

  const filteredDocuments = useMemo(() => {
    const search = documentSearchQuery.toLowerCase()

    return documents.filter((document) => {
      const matchesSearch =
        document.staff_name.toLowerCase().includes(search) ||
        document.staff_email?.toLowerCase().includes(search) ||
        document.document_type.toLowerCase().includes(search)

      const matchesStatus =
        documentStatusFilter === "all" || document.status === documentStatusFilter

      const matchesType =
        documentTypeFilter === "all" || document.document_type === documentTypeFilter

      return Boolean(matchesSearch && matchesStatus && matchesType)
    })
  }, [documents, documentSearchQuery, documentStatusFilter, documentTypeFilter])

  function getInitials(person: StaffMember) {
    return `${person.first_name?.[0] || ""}${person.last_name?.[0] || ""}`.toUpperCase()
  }

  function getTypeBadge(type: StaffType) {
    if (type === "instructor") return <Badge variant="outline">Instructor</Badge>
    if (type === "assistant") return <Badge variant="outline">Assistant</Badge>
    return <Badge variant="outline">Volunteer</Badge>
  }

  function getStatusBadge(status: StaffStatus) {
    if (status === "active") return <Badge>Active</Badge>
    if (status === "pending") return <Badge variant="secondary">Pending</Badge>
    if (status === "on_leave") return <Badge variant="outline">On Leave</Badge>
    return <Badge variant="secondary">Inactive</Badge>
  }

  function getBgCheckBadge(status?: BackgroundCheckStatus) {
    if (status === "cleared") return <Badge>Cleared</Badge>
    if (status === "pending") return <Badge variant="secondary">Pending</Badge>
    if (status === "expired") return <Badge variant="destructive">Expired</Badge>
    return <Badge variant="outline">Not Started</Badge>
  }

  const timeOptions = useMemo(() => {
    const options: string[] = []

    for (let hour = 7; hour <= 23; hour += 1) {
      for (const minute of [0, 30]) {
        const hour12 = hour > 12 ? hour - 12 : hour
        const period = hour >= 12 ? "PM" : "AM"
        options.push(`${hour12}:${minute === 0 ? "00" : "30"} ${period}`)
      }
    }

    return options
  }, [])

  function formatAssignmentDate(date: string) {
    if (!date) return ""

    const parsedDate = new Date(`${date}T00:00:00`)
    return parsedDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  }

  function formatShortDate(date: string | null) {
    if (!date) return "-"

    const parsedDate = new Date(`${date.slice(0, 10)}T00:00:00`)
    return parsedDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  function getDocumentStatusBadge(status: StaffDocumentStatus) {
    if (status === "verified") {
      return (
        <Badge className="gap-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
          <CheckCircle2 className="size-3" />
          Verified
        </Badge>
      )
    }

    if (status === "pending") {
      return (
        <Badge variant="outline" className="gap-1 border-amber-200 text-amber-700">
          <Timer className="size-3" />
          Pending
        </Badge>
      )
    }

    if (status === "expired") {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="size-3" />
          Expired
        </Badge>
      )
    }

    return (
      <Badge variant="secondary" className="gap-1">
        <XCircle className="size-3" />
        Missing
      </Badge>
    )
  }

  return (
    <>
      <Header title="Staff" />

      <div className="p-6 space-y-6 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Staff Management</h1>
            <p className="text-muted-foreground">
              Manage instructors, assistants, volunteers, and their records.
            </p>
          </div>

          <Dialog open={isAddStaffOpen} onOpenChange={setIsAddStaffOpen}>
            <DialogTrigger asChild>
              <Button className="bg-black text-white hover:bg-black/90">
                <UserPlus className="size-4 mr-2" />
                Add Staff Member
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Staff Member</DialogTitle>
                <DialogDescription>Create a new instructor, assistant, or volunteer.</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input
                      value={newStaff.first_name}
                      onChange={(event) => setNewStaff({ ...newStaff, first_name: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input
                      value={newStaff.last_name}
                      onChange={(event) => setNewStaff({ ...newStaff, last_name: event.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={newStaff.email}
                      onChange={(event) => setNewStaff({ ...newStaff, email: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={newStaff.phone}
                      onChange={(event) => setNewStaff({ ...newStaff, phone: event.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Staff Type</Label>
                    <Select
                      value={newStaff.staff_type}
                      onValueChange={(value) => setNewStaff({ ...newStaff, staff_type: value as StaffType })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="instructor">Instructor</SelectItem>
                        <SelectItem value="assistant">Assistant</SelectItem>
                        <SelectItem value="volunteer">Volunteer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={newStaff.status}
                      onValueChange={(value) => setNewStaff({ ...newStaff, status: value as StaffStatus })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="on_leave">On Leave</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Position</Label>
                    <Input
                      value={newStaff.position}
                      onChange={(event) => setNewStaff({ ...newStaff, position: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={newStaff.hire_date}
                      onChange={(event) => setNewStaff({ ...newStaff, hire_date: event.target.value })}
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddStaffOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddStaff}>Add Staff Member</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {!organizationId && (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No organization ID was found for the current user. Staff data cannot be loaded until the selected organization cookie is available.
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="overview">
              <Users className="size-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="assignments">
              <UserPlus className="size-4 mr-2" />
              Assignments
            </TabsTrigger>
            <TabsTrigger value="documents">
              <FileText className="size-4 mr-2" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="salaries">
              <Banknote className="size-4 mr-2" />
              Salaries & Pay
            </TabsTrigger>
            <TabsTrigger value="tuition">
              <CircleDollarSign className="size-4 mr-2" />
              Tuition Deductions
            </TabsTrigger>
            <TabsTrigger value="attendance">
              <Timer className="size-4 mr-2" />
              Time & Attendance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
                  <Users className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.total}</div>
                  <p className="text-xs text-muted-foreground">{stats.active} active</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">By Type</CardTitle>
                  <Briefcase className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.instructors}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.assistants} assistants, {stats.volunteers} volunteers
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Pending BG Checks</CardTitle>
                  <Shield className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.pendingBgChecks}</div>
                  <p className="text-xs text-muted-foreground">Require attention</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Expired Certifications</CardTitle>
                  <AlertCircle className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.expiredCertifications}</div>
                  <p className="text-xs text-muted-foreground">Need renewal</p>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col gap-4 lg:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or position..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full lg:w-[180px]">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="instructor">Instructor</SelectItem>
                  <SelectItem value="assistant">Assistant</SelectItem>
                  <SelectItem value="volunteer">Volunteer</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full lg:w-[180px]">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>

              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-full lg:w-[220px]">
                  <FolderOpen className="mr-2 size-4" />
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Background Check</TableHead>
                      <TableHead>Programs</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Loading staff...
                        </TableCell>
                      </TableRow>
                    ) : filteredStaff.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No staff members found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredStaff.map((person) => (
                        <TableRow key={person.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="size-8">
                                <AvatarFallback>{getInitials(person)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">
                                  {person.first_name} {person.last_name}
                                </div>
                                <div className="text-sm text-muted-foreground">{person.email || "No email"}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{getTypeBadge(person.staff_type)}</TableCell>
                          <TableCell>{person.position || "-"}</TableCell>
                          <TableCell>{getStatusBadge(person.status)}</TableCell>
                          <TableCell>{getBgCheckBadge(person.background_check_status)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {person.assigned_programs.length === 0 ? (
                                <span className="text-sm text-muted-foreground">No programs</span>
                              ) : (
                                person.assigned_programs.slice(0, 2).map((program) => (
                                  <Badge key={program} variant="secondary" className="text-xs">
                                    {program}
                                  </Badge>
                                ))
                              )}
                              {person.assigned_programs.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{person.assigned_programs.length - 2}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditingStaff(person)
                                    setIsEditStaffOpen(true)
                                  }}
                                >
                                  <Pencil className="size-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => handleDeleteStaff(person.id)}
                                >
                                  <Trash2 className="size-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="assignments" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Assignments</CardDescription>
                  <CardTitle className="text-3xl">{assignmentStats.total}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Instructors</CardDescription>
                  <CardTitle className="text-3xl">{assignmentStats.instructors}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Assistants</CardDescription>
                  <CardTitle className="text-3xl">{assignmentStats.assistants}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Volunteers</CardDescription>
                  <CardTitle className="text-3xl">{assignmentStats.volunteers}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Programs Staffed</CardDescription>
                  <CardTitle className="text-3xl">{assignmentStats.programsCovered}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Dialog open={isAddAssignmentOpen} onOpenChange={setIsAddAssignmentOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="size-4 mr-2" />
                  Add Assignment
                </Button>
              </DialogTrigger>

              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add Staff Assignment</DialogTitle>
                  <DialogDescription>Assign a staff member to a program.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Staff Member</Label>
                    <Select
                      value={newAssignment.staff_id}
                      onValueChange={(value) => setNewAssignment({ ...newAssignment, staff_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select staff member" />
                      </SelectTrigger>
                      <SelectContent>
                        {staff.map((person) => (
                          <SelectItem key={person.id} value={person.id}>
                            {person.first_name} {person.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Program</Label>
                    <Select
                      value={newAssignment.program_id}
                      onValueChange={(value) => setNewAssignment({ ...newAssignment, program_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select program" />
                      </SelectTrigger>
                      <SelectContent>
                        {programs.map((program) => (
                          <SelectItem key={program.id} value={program.id}>
                            {program.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select
                      value={newAssignment.role}
                      onValueChange={(value) => setNewAssignment({ ...newAssignment, role: value as StaffType })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="instructor">Instructor</SelectItem>
                        <SelectItem value="assistant">Assistant</SelectItem>
                        <SelectItem value="volunteer">Volunteer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>
                        Start Date<span className="text-red-500">*</span>
                      </Label>

                      <div className="relative">
                        <Calendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          type="date"
                          className="h-10 pl-9"
                          value={newAssignment.start_date}
                          onChange={(event) =>
                            setNewAssignment({ ...newAssignment, start_date: event.target.value })
                          }
                        />
                      </div>

                      {newAssignment.start_date && (
                        <p className="text-xs text-muted-foreground">
                          {formatAssignmentDate(newAssignment.start_date)}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>End Date</Label>

                      <div className="relative">
                        <Calendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          type="date"
                          className="h-10 pl-9"
                          value={newAssignment.end_date}
                          onChange={(event) =>
                            setNewAssignment({ ...newAssignment, end_date: event.target.value })
                          }
                        />
                      </div>

                      {newAssignment.end_date && (
                        <p className="text-xs text-muted-foreground">
                          {formatAssignmentDate(newAssignment.end_date)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>
                      Time<span className="text-red-500">*</span>
                    </Label>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Select
                        value={newAssignment.start_time}
                        onValueChange={(value) =>
                          setNewAssignment({ ...newAssignment, start_time: value })
                        }
                      >
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue placeholder="From 7:00 AM" />
                        </SelectTrigger>
                        <SelectContent>
                          <ScrollArea className="h-60">
                            {timeOptions.map((time) => (
                              <SelectItem key={time} value={time}>
                                {time}
                              </SelectItem>
                            ))}
                          </ScrollArea>
                        </SelectContent>
                      </Select>

                      <Select
                        value={newAssignment.end_time}
                        onValueChange={(value) =>
                          setNewAssignment({ ...newAssignment, end_time: value })
                        }
                      >
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue placeholder="to 7:30 AM" />
                        </SelectTrigger>
                        <SelectContent>
                          <ScrollArea className="h-60">
                            {timeOptions.map((time) => (
                              <SelectItem key={time} value={time}>
                                {time}
                              </SelectItem>
                            ))}
                          </ScrollArea>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddAssignmentOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddAssignment}>Add Assignment</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Card>
              <CardHeader>
                <CardTitle>Staff Assignments</CardTitle>
                <CardDescription>Program assignments for instructors, assistants, and volunteers.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff Member</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Program</TableHead>
                      <TableHead>Schedule</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No assignments yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      assignments.map((assignment) => (
                        <TableRow key={assignment.id}>
                          <TableCell>
                            <div className="font-medium">{assignment.staff_name}</div>
                            <div className="text-sm text-muted-foreground">{assignment.staff_email || ""}</div>
                          </TableCell>
                          <TableCell>{getTypeBadge(assignment.role)}</TableCell>
                          <TableCell>{assignment.program_name}</TableCell>
                          <TableCell>{assignment.schedule || "-"}</TableCell>
                          <TableCell>
                            {assignment.start_date || "-"}
                            {assignment.end_date ? ` - ${assignment.end_date}` : ""}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem disabled>
                                  <Pencil className="size-4 mr-2" />
                                  Edit Later
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => handleDeleteAssignment(assignment.id)}
                                >
                                  <Trash2 className="size-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Documents</h2>
                <p className="text-sm text-muted-foreground">
                  Track staff documents, uploads, expirations, and verification status.
                </p>
              </div>

              <Button className="bg-black text-white hover:bg-black/90">
                <Upload className="size-4 mr-2" />
                Upload Document
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
                  <FileText className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{documentStats.total}</div>
                  <p className="text-xs text-muted-foreground">Across all staff</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Verified</CardTitle>
                  <CheckCircle2 className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{documentStats.verified}</div>
                  <p className="text-xs text-muted-foreground">Ready for records</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
                  <Timer className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{documentStats.pending}</div>
                  <p className="text-xs text-muted-foreground">Require attention</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Expired / Missing</CardTitle>
                  <AlertCircle className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{documentStats.expired + documentStats.missing}</div>
                  <p className="text-xs text-muted-foreground">Need renewal or upload</p>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col gap-4 lg:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search by staff, email, or document type..."
                  className="pl-9"
                  value={documentSearchQuery}
                  onChange={(event) => setDocumentSearchQuery(event.target.value)}
                />
              </div>

              <Select value={documentTypeFilter} onValueChange={setDocumentTypeFilter}>
                <SelectTrigger className="w-full lg:w-[220px]">
                  <FileText className="mr-2 size-4" />
                  <SelectValue placeholder="All Document Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Document Types</SelectItem>
                  {documentTypes.map((documentType) => (
                    <SelectItem key={documentType} value={documentType}>
                      {documentType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={documentStatusFilter} onValueChange={setDocumentStatusFilter}>
                <SelectTrigger className="w-full lg:w-[200px]">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="missing">Missing</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff Member</TableHead>
                      <TableHead>Document</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="w-[120px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Loading documents...
                        </TableCell>
                      </TableRow>
                    ) : filteredDocuments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No documents found. Upload staff documents or connect a staff_documents table to populate this page.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredDocuments.map((document) => (
                        <TableRow key={document.id}>
                          <TableCell>
                            <div className="font-medium">{document.staff_name || "Unknown Staff"}</div>
                            <div className="text-sm text-muted-foreground">{document.staff_email || "No email"}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileText className="size-4 text-muted-foreground" />
                              <span>{document.document_type}</span>
                            </div>
                          </TableCell>
                          <TableCell>{getDocumentStatusBadge(document.status)}</TableCell>
                          <TableCell>{formatShortDate(document.uploaded_at)}</TableCell>
                          <TableCell>{formatShortDate(document.expires_at)}</TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" aria-label="View document">
                                <Eye className="size-4" />
                              </Button>
                              <Button variant="ghost" size="icon" aria-label="Download document">
                                <Download className="size-4" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" aria-label="More actions">
                                    <MoreHorizontal className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem>
                                    <Eye className="size-4 mr-2" />
                                    View
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Download className="size-4 mr-2" />
                                    Download
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-red-600">
                                    <Trash2 className="size-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="salaries">
            <ComingSoon title="Salaries & Pay" />
          </TabsContent>

          <TabsContent value="tuition">
            <ComingSoon title="Tuition Deductions" />
          </TabsContent>

          <TabsContent value="attendance">
            <ComingSoon title="Time & Attendance" />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isEditStaffOpen} onOpenChange={setIsEditStaffOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Staff Member</DialogTitle>
            <DialogDescription>Update this staff member.</DialogDescription>
          </DialogHeader>

          {editingStaff && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input
                    value={editingStaff.first_name}
                    onChange={(event) =>
                      setEditingStaff({ ...editingStaff, first_name: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input
                    value={editingStaff.last_name}
                    onChange={(event) =>
                      setEditingStaff({ ...editingStaff, last_name: event.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={editingStaff.email || ""}
                    onChange={(event) =>
                      setEditingStaff({ ...editingStaff, email: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={editingStaff.phone || ""}
                    onChange={(event) =>
                      setEditingStaff({ ...editingStaff, phone: event.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Staff Type</Label>
                  <Select
                    value={editingStaff.staff_type}
                    onValueChange={(value) =>
                      setEditingStaff({ ...editingStaff, staff_type: value as StaffType })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instructor">Instructor</SelectItem>
                      <SelectItem value="assistant">Assistant</SelectItem>
                      <SelectItem value="volunteer">Volunteer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editingStaff.status}
                    onValueChange={(value) =>
                      setEditingStaff({ ...editingStaff, status: value as StaffStatus })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="on_leave">On Leave</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Position</Label>
                  <Input
                    value={editingStaff.position || ""}
                    onChange={(event) =>
                      setEditingStaff({ ...editingStaff, position: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={editingStaff.hire_date || ""}
                    onChange={(event) =>
                      setEditingStaff({ ...editingStaff, hire_date: event.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditStaffOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateStaff}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ComingSoon({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          This section is intentionally paused until the main staff and assignments flow is working.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Connect this later after the staff, programs, and assignments tables are stable.
      </CardContent>
    </Card>
  )
}