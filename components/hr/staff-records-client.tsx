"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { linkStaffToContact } from "@/lib/contacts/contact-actions"
import { staffMemberProfileHref } from "@/lib/contacts/contact-profile-path"
import { syncStaffContactAffiliationsByContactId } from "@/lib/hr/staff-affiliation-actions"
import { createEmployeeFromContact } from "@/lib/contacts/contact-actions"
import { fetchApplicationDashboardStats } from "@/lib/applications/application-actions"
import { hrCategoryApplicationsUrl, HR_EMPLOYEE_APPLICATIONS_PATH } from "@/lib/applications/application-routes"
import { HrCategoryApplicationsPanel } from "@/components/applications/hr-category-applications-panel"
import { HrContactPicker } from "@/components/hr/hr-contact-picker"
import {
  HrDirectoryShell,
  formatEmploymentTenure,
  formatShortDate,
} from "@/components/workforce/hr-directory-shell"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { ListPagination } from "@/components/ui/list-pagination"
import {
  DEFAULT_LIST_PAGE_SIZE,
  slicePageItems,
} from "@/lib/ui/list-pagination"
import {
  Search,
  UserPlus,
  Users,
  Briefcase,
  MoreHorizontal,
  Trash2,
  Clock,
  Calendar,
  User,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import {
  hrOverviewHref,
  parseHrDirectoryView,
} from "@/lib/hr/hr-overview-path"
import { HrPositionsManager } from "@/components/hr/hr-positions-manager"

type StaffType = "full_time" | "part_time" | "temporary" | "contract" | "seasonal"
type StaffStatus = "active" | "inactive" | "on_leave" | "pending"

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
}

const STAFF_TYPE_BADGE_CLASS: Record<string, string> = {
  full_time: "border-transparent bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  part_time: "border-transparent bg-sky-100 text-sky-800 hover:bg-sky-100",
  seasonal: "border-transparent bg-violet-100 text-violet-800 hover:bg-violet-100",
  temporary: "border-transparent bg-amber-100 text-amber-900 hover:bg-amber-100",
  contract: "border-transparent bg-slate-100 text-slate-800 hover:bg-slate-100",
}

type Department = { id: string; name: string }
type HrPositionOption = { id: string; name: string }

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

function percentOf(part: number, total: number) {
  if (total <= 0) return "0% of total"
  return `${((part / total) * 100).toFixed(part === 0 || part === total ? 0 : 1)}% of total`
}

export function StaffRecordsClient({
  organizationId,
}: {
  organizationId: string | null
  embedded?: boolean
  section?: StaffRecordsSection
}) {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [assignments, setAssignments] = useState<StaffAssignment[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [hrPositions, setHrPositions] = useState<HrPositionOption[]>([])

  const [directoryTab, setDirectoryTab] = useState<
    "employees" | "applications" | "positions"
  >(() => {
    const view = parseHrDirectoryView(searchParams, { legacyTabParam: true })
    if (view === "applications" || view === "positions") return view
    return "employees"
  })
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive">("active")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [positionFilter, setPositionFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_LIST_PAGE_SIZE)
  const [applicationsCount, setApplicationsCount] = useState(0)
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false)
  const [savingStaff, setSavingStaff] = useState(false)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [selectedContactLabel, setSelectedContactLabel] = useState("")

  const [newStaff, setNewStaff] = useState({
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

  useEffect(() => {
    void (async () => {
      try {
        const stats = await fetchApplicationDashboardStats({ applicationType: "employment" })
        setApplicationsCount(stats.pendingReview || stats.total || 0)
      } catch (error) {
        console.warn("Could not load employment application stats:", error)
        setApplicationsCount(0)
      }
    })()
  }, [])

  useEffect(() => {
    const view = parseHrDirectoryView(searchParams, { legacyTabParam: true })
    if (view === "applications") {
      setDirectoryTab("applications")
    } else if (view === "positions") {
      setDirectoryTab("positions")
    } else {
      setDirectoryTab("employees")
    }
  }, [searchParams])

  useEffect(() => {
    setPage(1)
  }, [directoryTab, searchQuery, typeFilter, statusFilter, departmentFilter, positionFilter])

  function setDirectoryTabAndUrl(tabId: "employees" | "applications" | "positions") {
    setDirectoryTab(tabId)
    if (tabId === "applications") {
      router.replace(hrOverviewHref({ tab: "employees", view: "applications" }), {
        scroll: false,
      })
      return
    }
    if (tabId === "positions") {
      router.replace(hrOverviewHref({ tab: "employees", view: "positions" }), { scroll: false })
      return
    }
    router.replace(hrOverviewHref({ tab: "employees" }), { scroll: false })
  }

  const isRosterView = directoryTab === "employees"

  async function fetchPageData() {
    if (!organizationId) {
      setStaff([])
      setAssignments([])
      setDepartments([])
      setHrPositions([])
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
    if (!organizationId || !selectedContactId) {
      alert("Select a contact first. Create them in Contacts if they are not listed.")
      return
    }

    const selectedPosition = hrPositions.find((item) => item.id === newStaff.position_id)
    setSavingStaff(true)

    try {
      await createEmployeeFromContact({
        contactId: selectedContactId,
        staff_type: newStaff.staff_type,
        status: newStaff.status,
        position_id: newStaff.position_id || null,
        position_name: selectedPosition?.name || null,
        hr_job_role_id: newStaff.hr_job_role_id || null,
        hire_date: newStaff.hire_date || null,
        department_id: newStaff.department_id || null,
      })

      setNewStaff({
        staff_type: "full_time",
        status: "active",
        position_id: "",
        hr_job_role_id: "",
        hire_date: "",
        department_id: "",
      })
      setSelectedContactId(null)
      setSelectedContactLabel("")
      setIsAddStaffOpen(false)
      await fetchPageData()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not add employee"
      alert(message)
    } finally {
      setSavingStaff(false)
    }
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

  const directoryStaff = useMemo(() => {
    if (statusFilter === "inactive") {
      return staff.filter((person) => person.status === "inactive")
    }
    return staff.filter((person) => person.status !== "inactive")
  }, [staff, statusFilter])

  const stats = useMemo(() => {
    const base = staff.filter((p) => p.status !== "inactive")
    const total = base.length
    return {
      total,
      fullTime: base.filter((person) => person.staff_type === "full_time").length,
      partTime: base.filter((person) => person.staff_type === "part_time").length,
      seasonal: base.filter((person) => person.staff_type === "seasonal").length,
    }
  }, [staff])

  const filteredStaff = useMemo(() => {
    return directoryStaff.filter((person) => {
      const fullName = `${person.first_name} ${person.last_name}`.toLowerCase()
      const search = searchQuery.toLowerCase()

      const matchesSearch =
        !search ||
        fullName.includes(search) ||
        person.email?.toLowerCase().includes(search) ||
        person.position_name?.toLowerCase().includes(search) ||
        person.position?.toLowerCase().includes(search) ||
        person.department_name?.toLowerCase().includes(search) ||
        person.hr_job_role_name?.toLowerCase().includes(search)

      const matchesType = typeFilter === "all" || person.staff_type === typeFilter

      const personAssignments = assignments.filter((assignment) => assignment.staff_id === person.id)
      const matchesDepartment =
        departmentFilter === "all" ||
        person.department_id === departmentFilter ||
        personAssignments.some((assignment) => assignment.department_id === departmentFilter)

      const matchesPosition =
        positionFilter === "all" ||
        person.position_id === positionFilter ||
        person.position_name === positionFilter

      return Boolean(matchesSearch && matchesType && matchesDepartment && matchesPosition)
    })
  }, [
    directoryStaff,
    assignments,
    searchQuery,
    typeFilter,
    departmentFilter,
    positionFilter,
  ])

  const currentPage = Math.min(page, Math.max(1, Math.ceil(filteredStaff.length / pageSize) || 1))
  const pagedStaff = slicePageItems(filteredStaff, currentPage, pageSize)

  function getInitials(person: StaffMember) {
    return `${person.first_name?.[0] || ""}${person.last_name?.[0] || ""}`.toUpperCase()
  }

  function getStaffTypeBadge(type: StaffType | string) {
    const label = STAFF_TYPE_LABELS[type] || type.replace(/_/g, " ")
    return (
      <Badge variant="outline" className={cn(STAFF_TYPE_BADGE_CLASS[type])}>
        {label}
      </Badge>
    )
  }

  function getStatusCell(status: StaffStatus) {
    const label =
      status === "active"
        ? "Active"
        : status === "pending"
          ? "Pending"
          : status === "on_leave"
            ? "On Leave"
            : "Inactive"
    const dotClass =
      status === "active"
        ? "bg-emerald-500"
        : status === "on_leave"
          ? "bg-amber-500"
          : status === "pending"
            ? "bg-sky-500"
            : "bg-muted-foreground/50"
    return (
      <span className="inline-flex items-center gap-2 text-sm">
        <span className={cn("size-2 rounded-full", dotClass)} />
        {label}
      </span>
    )
  }

  function handleExport() {
    const header = [
      "First Name",
      "Last Name",
      "Email",
      "Department",
      "Position",
      "Employment Type",
      "Status",
      "Start Date",
      "Programs",
    ]
    const lines = filteredStaff.map((person) =>
      [
        person.first_name,
        person.last_name,
        person.email || "",
        person.department_name || "",
        person.position_name || person.position || "",
        STAFF_TYPE_LABELS[person.staff_type] || person.staff_type,
        person.status,
        person.hire_date || "",
        person.assigned_programs.join("; "),
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(",")
    )
    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `employees-${directoryTab}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <HrDirectoryShell
        title="Employees"
        description="Manage your organization's employees. Employees are linked to their contact profiles."
        onExport={isRosterView ? handleExport : undefined}
        exportDisabled={filteredStaff.length === 0}
        primaryAction={
          isRosterView ? (
          <Button type="button" onClick={() => setIsAddStaffOpen(true)}>
            <UserPlus className="mr-2 size-4" />
            Add Employee
          </Button>
          ) : undefined
        }
        tabs={[
          { id: "employees", label: "Employees" },
          {
            id: "applications",
            label: "Applications",
            count: applicationsCount,
          },
          { id: "positions", label: "Positions" },
        ]}
        activeTab={directoryTab}
        onTabChange={(tabId) => {
          if (
            tabId === "employees" ||
            tabId === "applications" ||
            tabId === "positions"
          ) {
            setDirectoryTabAndUrl(tabId)
          }
        }}
        stats={
          isRosterView ? (
          <StatCardsRow equal columns={4}>
            <StatCard
              layout="header"
              fill
              tone="blue"
              label="Total Employees"
              value={stats.total}
              hint="All active employees"
              icon={Users}
            />
            <StatCard
              layout="header"
              fill
              tone="emerald"
              label="Full-Time"
              value={stats.fullTime}
              hint={percentOf(stats.fullTime, stats.total)}
              icon={Briefcase}
            />
            <StatCard
              layout="header"
              fill
              tone="sky"
              label="Part-Time"
              value={stats.partTime}
              hint={percentOf(stats.partTime, stats.total)}
              icon={Clock}
            />
            <StatCard
              layout="header"
              fill
              tone="violet"
              label="Seasonal"
              value={stats.seasonal}
              hint={percentOf(stats.seasonal, stats.total)}
              icon={Calendar}
            />
          </StatCardsRow>
          ) : undefined
        }
        filters={
          isRosterView ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, department, position..."
                className="pl-9"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full lg:w-[180px]">
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
            <Select value={positionFilter} onValueChange={setPositionFilter}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="All Positions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Positions</SelectItem>
                {hrPositions.map((position) => (
                  <SelectItem key={position.id} value={position.id}>
                    {position.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="All Employment Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employment Types</SelectItem>
                {STAFF_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as "active" | "inactive")
              }
            >
              <SelectTrigger className="w-full lg:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          ) : undefined
        }
        footer={
          isRosterView ? (
            <ListPagination
              page={currentPage}
              pageSize={pageSize}
              total={filteredStaff.length}
              entryLabel="employees"
              onPageChange={setPage}
              onPageSizeChange={(next) => {
                setPageSize(next)
                setPage(1)
              }}
            />
          ) : undefined
        }
      >
        {directoryTab === "applications" ? (
          <Suspense
            fallback={
              <div className="h-64 animate-pulse rounded-lg bg-muted" />
            }
          >
            <HrCategoryApplicationsPanel
              applicationType="employment"
              syncPath={HR_EMPLOYEE_APPLICATIONS_PATH}
              title="Employment Applications"
              description="Review employment application submissions."
            />
          </Suspense>
        ) : directoryTab === "positions" ? (
          <HrPositionsManager />
        ) : !organizationId ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No organization ID was found for the current user. Staff data cannot be loaded until
              the selected organization cookie is available.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Employment Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>Programs</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                        Loading employees...
                      </TableCell>
                    </TableRow>
                  ) : pagedStaff.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                        No employees found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagedStaff.map((person) => {
                      const profileHref = staffMemberProfileHref({
                        staffId: person.id,
                        contactId: person.contact_id,
                      })
                      const tenure = formatEmploymentTenure(person.hire_date)
                      return (
                        <TableRow
                          key={person.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => router.push(profileHref)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="size-9">
                                <AvatarFallback>{getInitials(person)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <Link
                                  href={profileHref}
                                  className="font-medium hover:text-primary hover:underline"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  {person.first_name} {person.last_name}
                                </Link>
                                <div className="text-sm text-muted-foreground">
                                  {person.email || "No email"}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{person.department_name || "—"}</TableCell>
                          <TableCell>{person.position_name || person.position || "—"}</TableCell>
                          <TableCell>{getStaffTypeBadge(person.staff_type)}</TableCell>
                          <TableCell>{getStatusCell(person.status)}</TableCell>
                          <TableCell>
                            <div className="text-sm">{formatShortDate(person.hire_date)}</div>
                            {tenure ? (
                              <div className="text-xs text-muted-foreground">{tenure}</div>
                            ) : null}
                          </TableCell>
                          <TableCell onClick={(event) => event.stopPropagation()}>
                            {person.assigned_programs.length === 0 ? (
                              <span className="text-sm text-muted-foreground">—</span>
                            ) : (
                              <Link
                                href={profileHref}
                                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                              >
                                <User className="size-3.5" />
                                {person.assigned_programs.length} · View
                              </Link>
                            )}
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
                                  <Link href={profileHref}>
                                    <UserPlus className="mr-2 size-4" />
                                    View profile
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => handleDeleteStaff(person.id)}
                                >
                                  <Trash2 className="mr-2 size-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </HrDirectoryShell>

      <Dialog
        open={isAddStaffOpen}
        onOpenChange={(open) => {
          setIsAddStaffOpen(open)
          if (!open) {
            setSelectedContactId(null)
            setSelectedContactLabel("")
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Employee</DialogTitle>
            <DialogDescription>
              Search Directory for an existing person, or create a contact if they are not
              listed, then set their employment details.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <HrContactPicker
              selectedContactId={selectedContactId}
              selectedLabel={selectedContactLabel}
              allowCreate
              individualOnly
              createDescription="Create a Directory person, then add them as an employee."
              onChange={(contact) => {
                setSelectedContactId(contact.contactId)
                const name = contact.full_name?.trim() || "Unnamed"
                const detail = contact.email || contact.phone
                setSelectedContactLabel(detail ? `${name} (${detail})` : name)
              }}
              onClear={() => {
                setSelectedContactId(null)
                setSelectedContactLabel("")
              }}
              disabled={savingStaff}
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Employment Type</Label>
                <Select
                  value={newStaff.staff_type}
                  onValueChange={(value) =>
                    setNewStaff({ ...newStaff, staff_type: value as StaffType })
                  }
                  disabled={savingStaff}
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
                  onValueChange={(value) =>
                    setNewStaff({ ...newStaff, status: value as StaffStatus })
                  }
                  disabled={savingStaff}
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
                  disabled={savingStaff}
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
                  disabled={savingStaff}
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

            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={newStaff.hire_date}
                onChange={(event) => setNewStaff({ ...newStaff, hire_date: event.target.value })}
                disabled={savingStaff}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddStaffOpen(false)}
              disabled={savingStaff}
            >
              Cancel
            </Button>
            <Button onClick={handleAddStaff} disabled={savingStaff || !selectedContactId}>
              {savingStaff ? "Saving..." : "Add Employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
