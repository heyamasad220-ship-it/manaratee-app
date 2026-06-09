"use client"

import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { linkStaffToContact } from "@/lib/contacts/contact-actions"
import { staffMemberProfileHref } from "@/lib/contacts/contact-profile-path"
import {
  syncStaffContactAffiliations,
  syncStaffContactAffiliationsByContactId,
} from "@/lib/hr/staff-affiliation-actions"
import { StatCardsRow, statCardWidthClassName } from "@/components/ui/stat-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  UserPlus,
  Users,
  Briefcase,
  MoreHorizontal,
  Trash2,
  FolderOpen,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type StaffType = "full_time" | "part_time" | "temporary" | "contract" | "seasonal"
type StaffStatus = "active" | "inactive" | "on_leave" | "pending"
type BackgroundCheckStatus = "cleared" | "pending" | "expired" | "not_started"

const STAFF_TYPE_OPTIONS: { value: StaffType; label: string }[] = [
  { value: "full_time", label: "Full-Time" },
  { value: "part_time", label: "Part-Time" },
  { value: "temporary", label: "Temporary" },
  { value: "contract", label: "Contract" },
  { value: "seasonal", label: "Seasonal" },
]

const STAFF_TYPE_LABELS: Record<string, string> = {
  full_time: "Full-Time",
  part_time: "Part-Time",
  temporary: "Temporary",
  contract: "Contract",
  seasonal: "Seasonal",
  instructor: "Instructor",
  assistant: "Assistant",
  volunteer: "Volunteer",
}

type Department = {
  id: string
  name: string
}

type HrPositionOption = {
  id: string
  name: string
}

type HrJobRoleOption = {
  id: string
  name: string
}

type StaffMember = {
  id: string
  contact_id: string | null
  organization_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  staff_type: StaffType
  status: StaffStatus
  position: string | null
  position_id: string | null
  position_name: string | null
  hr_job_role_id: string | null
  hr_job_role_name: string | null
  hire_date: string | null
  department_id: string | null
  department_name: string | null
  background_check_status?: BackgroundCheckStatus
  assigned_programs: string[]
}

type StaffAssignment = {
  id: string
  staff_id: string
  program_id: string
  department_id: string | null
  program_name: string
}

export type StaffRecordsSection = "overview"

export function StaffRecordsClient({
  organizationId,
  embedded = false,
}: {
  organizationId: string | null
  embedded?: boolean
  section?: StaffRecordsSection
}) {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [assignments, setAssignments] = useState<StaffAssignment[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [hrPositions, setHrPositions] = useState<HrPositionOption[]>([])
  const [hrJobRoles, setHrJobRoles] = useState<HrJobRoleOption[]>([])

  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [departmentFilter, setDepartmentFilter] = useState("all")

  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false)

  const router = useRouter()

  const [newStaff, setNewStaff] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    staff_type: "full_time" as StaffType,
    status: "active" as StaffStatus,
    position_id: "",
    hr_job_role_id: "",
    hire_date: "",
    department_id: "",
  })

  useEffect(() => {
    void fetchPageData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  async function fetchPageData() {
    if (!organizationId) {
      setStaff([])
      setAssignments([])
      setDepartments([])
      setHrPositions([])
      setHrJobRoles([])
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

      const { data: positionsData, error: positionsError } = await supabase
        .from("hr_positions")
        .select("id, name")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("name")

      if (positionsError && positionsError.code !== "42P01") throw positionsError
      setHrPositions((positionsData || []) as HrPositionOption[])

      const { data: jobRolesData, error: jobRolesError } = await supabase
        .from("hr_job_roles")
        .select("id, name")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("name")

      if (jobRolesError && jobRolesError.code !== "42P01") throw jobRolesError
      setHrJobRoles((jobRolesData || []) as HrJobRoleOption[])

      const { data: staffData, error: staffError } = await supabase
        .from("staff")
        .select(`
          *,
          hr_positions:position_id (name),
          hr_job_roles:hr_job_role_id (name),
          departments:department_id (name)
        `)
        .eq("organization_id", organizationId)
        .order("last_name")

      if (staffError) throw staffError

      const { data: assignmentData, error: assignmentError } = await supabase
        .from("staff_assignments")
        .select(`
          id,
          staff_id,
          program_id,
          program:program_id (
            name,
            department_id
          )
        `)
        .eq("organization_id", organizationId)

      if (assignmentError) throw assignmentError

      const formattedAssignments: StaffAssignment[] = (assignmentData || []).map((item: any) => ({
        id: item.id,
        staff_id: item.staff_id,
        program_id: item.program_id,
        program_name: item.program?.name || "Unknown Program",
        department_id: item.program?.department_id || null,
      }))

      const staffWithPrograms: StaffMember[] = (staffData || []).map((person: any) => ({
        id: person.id,
        contact_id: person.contact_id ?? null,
        organization_id: person.organization_id,
        first_name: person.first_name,
        last_name: person.last_name,
        email: person.email,
        phone: person.phone,
        staff_type: (person.staff_type || "full_time") as StaffType,
        status: person.status || "active",
        position: person.position,
        position_id: person.position_id || null,
        position_name: person.hr_positions?.name || null,
        hr_job_role_id: person.hr_job_role_id || null,
        hr_job_role_name: person.hr_job_roles?.name || null,
        hire_date: person.hire_date,
        department_id: person.department_id || null,
        department_name: person.departments?.name || null,
        background_check_status: person.background_check_status || "not_started",
        assigned_programs: formattedAssignments
          .filter((assignment) => assignment.staff_id === person.id)
          .map((assignment) => assignment.program_name),
      }))

      setStaff(staffWithPrograms)
      setAssignments(formattedAssignments)
    } catch (error: any) {
      console.error("Staff page error:", error)
      alert(error?.message || "Something went wrong while loading staff data.")
    } finally {
      setLoading(false)
    }
  }

  async function handleAddStaff() {
    if (!organizationId || !newStaff.first_name || !newStaff.last_name) return

    const selectedPosition = hrPositions.find((item) => item.id === newStaff.position_id)

    const { data: createdStaff, error } = await supabase
      .from("staff")
      .insert({
        organization_id: organizationId,
        first_name: newStaff.first_name,
        last_name: newStaff.last_name,
        email: newStaff.email || null,
        phone: newStaff.phone || null,
        staff_type: newStaff.staff_type,
        status: newStaff.status,
        position: selectedPosition?.name || null,
        position_id: newStaff.position_id || null,
        hr_job_role_id: newStaff.hr_job_role_id || null,
        hire_date: newStaff.hire_date || null,
        department_id: newStaff.department_id || null,
      })
      .select("id")
      .single()

    if (error) {
      console.error("Add staff error:", error)
      alert(error.message)
      return
    }

    if (createdStaff?.id) {
      try {
        await linkStaffToContact({
          staffId: createdStaff.id,
          fullName: `${newStaff.first_name} ${newStaff.last_name}`.trim(),
          email: newStaff.email || null,
          phone: newStaff.phone || null,
        })
      } catch (linkError: any) {
        console.warn("Staff saved but contact link failed:", linkError?.message)
      }
    }

    setNewStaff({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      staff_type: "full_time",
      status: "active",
      position_id: "",
      hr_job_role_id: "",
      hire_date: "",
      department_id: "",
    })

    setIsAddStaffOpen(false)
    await fetchPageData()
  }

  async function handleDeleteStaff(id: string) {
    if (!organizationId) return

    const confirmed = window.confirm("Delete this staff member? This cannot be undone.")
    if (!confirmed) return

    const person = staff.find((row) => row.id === id)
    const linkedContactId = person
      ? (
          await supabase
            .from("staff")
            .select("contact_id")
            .eq("id", id)
            .eq("organization_id", organizationId)
            .maybeSingle()
        ).data?.contact_id ?? null
      : null

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

    try {
      await syncStaffContactAffiliationsByContactId(linkedContactId as string | null)
    } catch (syncError) {
      console.warn("Staff deleted but affiliation sync failed:", syncError)
    }

    await fetchPageData()
  }

  const stats = useMemo(() => {
    return {
      total: staff.length,
      active: staff.filter((person) => person.status === "active").length,
      fullTime: staff.filter((person) => person.staff_type === "full_time").length,
      partTime: staff.filter((person) => person.staff_type === "part_time").length,
      temporary: staff.filter((person) => person.staff_type === "temporary").length,
      contract: staff.filter((person) => person.staff_type === "contract").length,
      seasonal: staff.filter((person) => person.staff_type === "seasonal").length,
    }
  }, [staff])

  const filteredStaff = useMemo(() => {
    return staff.filter((person) => {
      const fullName = `${person.first_name} ${person.last_name}`.toLowerCase()
      const search = searchQuery.toLowerCase()

      const matchesSearch =
        fullName.includes(search) ||
        person.email?.toLowerCase().includes(search) ||
        person.position_name?.toLowerCase().includes(search) ||
        person.position?.toLowerCase().includes(search) ||
        person.department_name?.toLowerCase().includes(search) ||
        person.hr_job_role_name?.toLowerCase().includes(search)

      const matchesType = typeFilter === "all" || person.staff_type === typeFilter
      const matchesStatus = statusFilter === "all" || person.status === statusFilter

      const personAssignments = assignments.filter((assignment) => assignment.staff_id === person.id)
      const matchesDepartment =
        departmentFilter === "all" ||
        person.department_id === departmentFilter ||
        personAssignments.some((assignment) => assignment.department_id === departmentFilter)

      return Boolean(matchesSearch && matchesType && matchesStatus && matchesDepartment)
    })
  }, [staff, assignments, searchQuery, typeFilter, statusFilter, departmentFilter])

  function getInitials(person: StaffMember) {
    return `${person.first_name?.[0] || ""}${person.last_name?.[0] || ""}`.toUpperCase()
  }

  function getStaffTypeBadge(type: StaffType | string) {
    const label = STAFF_TYPE_LABELS[type] || type.replace(/_/g, " ")
    return <Badge variant="outline">{label}</Badge>
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

  return (
    <>
      <div className={embedded ? "flex flex-col gap-6" : "w-full space-y-6 p-6"}>
        <div className="flex justify-end">
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
                        {STAFF_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
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
                    <Label>Department</Label>
                    <Select
                      value={newStaff.department_id || "none"}
                      onValueChange={(value) =>
                        setNewStaff({
                          ...newStaff,
                          department_id: value === "none" ? "" : value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No department</SelectItem>
                        {departments.map((department) => (
                          <SelectItem key={department.id} value={department.id}>
                            {department.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Position</Label>
                    <Select
                      value={newStaff.position_id || "none"}
                      onValueChange={(value) =>
                        setNewStaff({
                          ...newStaff,
                          position_id: value === "none" ? "" : value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select position" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No position</SelectItem>
                        {hrPositions.map((position) => (
                          <SelectItem key={position.id} value={position.id}>
                            {position.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select
                      value={newStaff.hr_job_role_id || "none"}
                      onValueChange={(value) =>
                        setNewStaff({
                          ...newStaff,
                          hr_job_role_id: value === "none" ? "" : value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No role</SelectItem>
                        {hrJobRoles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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

        <Tabs
          value="overview"
          className="space-y-6"
        >
          <TabsContent value="overview" className="space-y-6">
            <StatCardsRow>
              <Card className={statCardWidthClassName}>
                <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                  <CardTitle className="whitespace-nowrap text-sm font-medium">Total Staff</CardTitle>
                  <Users className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.total}</div>
                  <p className="text-xs text-muted-foreground">{stats.active} active</p>
                </CardContent>
              </Card>

              <Card className={statCardWidthClassName}>
                <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                  <CardTitle className="whitespace-nowrap text-sm font-medium">Full-Time</CardTitle>
                  <Briefcase className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats.fullTime}</div>
                  <p className="max-w-xs text-xs text-muted-foreground">
                    {stats.partTime} part-time, {stats.temporary} temporary, {stats.contract} contract,{" "}
                    {stats.seasonal} seasonal
                  </p>
                </CardContent>
              </Card>
            </StatCardsRow>

            <div className="flex flex-col gap-4 lg:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, department, position, or role..."
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
                  {STAFF_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
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
                      <TableHead>Department</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Background Check</TableHead>
                      <TableHead>Programs</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          Loading staff...
                        </TableCell>
                      </TableRow>
                    ) : filteredStaff.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          No staff members found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredStaff.map((person) => (
                        <TableRow
                          key={person.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() =>
                            router.push(
                              staffMemberProfileHref({
                                staffId: person.id,
                                contactId: person.contact_id,
                              })
                            )
                          }
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="size-8">
                                <AvatarFallback>{getInitials(person)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <Link
                                  href={staffMemberProfileHref({
                                    staffId: person.id,
                                    contactId: person.contact_id,
                                  })}
                                  className="font-medium hover:text-primary hover:underline"
                                >
                                  {person.first_name} {person.last_name}
                                </Link>
                                <div className="text-sm text-muted-foreground">{person.email || "No email"}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{getStaffTypeBadge(person.staff_type)}</TableCell>
                          <TableCell>{person.department_name || "-"}</TableCell>
                          <TableCell>{person.position_name || person.position || "-"}</TableCell>
                          <TableCell>{person.hr_job_role_name || "-"}</TableCell>
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
                          <TableCell onClick={(event) => event.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={staffMemberProfileHref({
                                      staffId: person.id,
                                      contactId: person.contact_id,
                                    })}
                                  >
                                    <UserPlus className="size-4 mr-2" />
                                    View profile
                                  </Link>
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
        </Tabs>
      </div>
    </>
  )
}
