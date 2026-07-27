"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Header } from "@/components/layout/header"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

import {
  AlertCircle,
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Download,
  FileText,
  FolderOpen,
  Mail,
  MoreHorizontal,
  Phone,

  Search,
  Send,
  TrendingUp,
  UserPlus,
  Users,
  X,
  XCircle,
} from "lucide-react"

import {
  ProgramsAttendanceReportPanel,
  ProgramsWaitlistReportPanel,
} from "@/components/programs/programs-attendance-waitlist-report-panels"
import {
  ProgramsReportsNav,
  resolveProgramsReportsTab,
  type ProgramsReportsTabId,
} from "@/components/programs/programs-reports-nav"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
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
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

type Program = {
  id: string
  name: string
  description: string | null
  department_id: string | null
  capacity: number | null
  enrolled: number | null
  waitlist: number | null
  status: string | null
  start_date: string | null
  end_date: string | null
}

type Department = {
  id: string
  name: string
  color: string | null
}

type Enrollment = {
  id: string
  organization_id: string | null
  program_id: string | null
  department_id: string | null
  child_name: string
  child_age: number | null
  parent_name: string | null
  parent_email: string | null
  parent_phone: string | null
  session_name: string | null
  weeks: string[] | null
  enrollment_date: string | null
  status: "confirmed" | "pending" | "cancelled"
  payment_status: "paid" | "partial" | "pending"
  amount_paid: number | null
  total_amount: number | null
  before_care: boolean | null
  after_care: boolean | null
  lunch_type: "none" | "basic" | "hot" | null
  notes: string | null
  program?: Program | null
}

type SortDirection = "asc" | "desc"

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"

  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}


function exportCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return

  const headers = Object.keys(rows[0])
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`

  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n")

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = filename
  link.click()

  URL.revokeObjectURL(url)
}

function getStatusBadge(status: string) {
  switch (status) {
    case "confirmed":
    case "approved":
    case "paid":
    case "converted":
      return <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">{status}</Badge>
    case "pending":
    case "waiting":
      return <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">{status}</Badge>
    case "offered":
      return <Badge className="bg-violet-500/10 text-violet-600 hover:bg-violet-500/20">{status}</Badge>
    case "cancelled":
    case "denied":
    case "expired":
    case "late":
      return <Badge className="bg-red-500/10 text-red-600 hover:bg-red-500/20">{status}</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function getPaymentBadge(status: string) {
  switch (status) {
    case "paid":
      return <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">Paid</Badge>
    case "partial":
      return <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">Partial</Badge>
    case "pending":
      return <Badge className="bg-red-500/10 text-red-600 hover:bg-red-500/20">Pending</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function getPriorityBadge(priority: string) {
  if (priority === "sibling") {
    return <Badge className="bg-violet-500/10 text-violet-600 hover:bg-violet-500/20">Sibling</Badge>
  }

  if (priority === "returning") {
    return <Badge className="bg-sky-500/10 text-sky-600 hover:bg-sky-500/20">Returning</Badge>
  }

  return <Badge variant="outline">Normal</Badge>
}

function SortButton({
  field,
  label,
  sortField,
  sortDirection,
  onSort,
}: {
  field: string
  label: string
  sortField: string
  sortDirection: SortDirection
  onSort: (field: string) => void
}) {
  return (
    <Button variant="ghost" className="-ml-4 gap-1" onClick={() => onSort(field)}>
      {label}
      {sortField === field ? (
        sortDirection === "asc" ? (
          <ChevronUp className="size-4" />
        ) : (
          <ChevronDown className="size-4" />
        )
      ) : (
        <ArrowUpDown className="size-4 opacity-40" />
      )}
    </Button>
  )
}

export default function ProgramsReportsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const activeTab: ProgramsReportsTabId = resolveProgramsReportsTab(
    "/programs/reports",
    searchParams
  )

  React.useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab === "enrollment") {
      router.replace("/programs/registrations")
      return
    }
    if (tab === "transactions") {
      router.replace("/finance/transactions")
    }
  }, [router, searchParams])

  const [loading, setLoading] = React.useState(true)
  const [tablesAvailable, setTablesAvailable] = React.useState(true)

  const [programs, setPrograms] = React.useState<Program[]>([])
  const [departments, setDepartments] = React.useState<Department[]>([])
  const [enrollments, setEnrollments] = React.useState<Enrollment[]>([])
  const [activeOfferingCount, setActiveOfferingCount] = React.useState(0)

  const [searchQuery, setSearchQuery] = React.useState("")
  const [departmentFilter, setDepartmentFilter] = React.useState("all")
  const [programFilter, setProgramFilter] = React.useState("all")
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [dateRange, setDateRange] = React.useState("this-month")
  const [sortField, setSortField] = React.useState("enrollment_date")
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc")

  const [messageDialog, setMessageDialog] = React.useState<{
    type: "enrollment"
    entry: Enrollment
  } | null>(null)
  const [message, setMessage] = React.useState("")

  React.useEffect(() => {
    void fetchReportsData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchReportsData() {
    setLoading(true)

    try {
      const [
        programsResult,
        departmentsResult,
        enrollmentsResult,
      ] = await Promise.all([
        supabase
          .from("programs")
          .select("id, name, description, department_id, capacity, enrolled, waitlist, status, start_date, end_date")
          .in("status", ["draft", "active", "paused", "closed"])
          .order("name"),
        supabase.from("departments").select("id, name, color").order("name"),
        supabase
          .from("program_enrollments")
          .select(`
            *,
            program:program_id (
              id,
              name,
              description,
              department_id,
              capacity,
              enrolled,
              waitlist,
              status,
              start_date,
              end_date
            )
          `)
          .order("enrollment_date", { ascending: false }),
      ])

      const missingTableErrors = [
        programsResult.error,
        departmentsResult.error,
        enrollmentsResult.error,
      ].filter((error) => error?.code === "42P01" || error?.code === "42703")

      setTablesAvailable(missingTableErrors.length === 0)

      if (!programsResult.error) {
        setPrograms((programsResult.data || []) as Program[])
      } else {
        console.warn("programs could not be loaded:", programsResult.error.message)
      }

      const openProgramIds = ((programsResult.data || []) as Program[]).map(
        (program) => program.id
      )

      if (openProgramIds.length > 0) {
        const offeringsResult = await supabase
          .from("program_offerings")
          .select("id", { count: "exact", head: true })
          .in("program_id", openProgramIds)
          .eq("status", "active")

        if (offeringsResult.error) {
          console.warn(
            "program_offerings count could not be loaded:",
            offeringsResult.error.message
          )
          setActiveOfferingCount(0)
        } else {
          setActiveOfferingCount(offeringsResult.count || 0)
        }
      } else {
        setActiveOfferingCount(0)
      }

      if (!departmentsResult.error) setDepartments((departmentsResult.data || []) as Department[])
      else console.warn("departments could not be loaded:", departmentsResult.error.message)

      if (!enrollmentsResult.error) {
        const openProgramIdSet = new Set(openProgramIds)
        const openEnrollments = ((enrollmentsResult.data || []) as Enrollment[]).filter(
          (enrollment) => {
            if (enrollment.program_id && openProgramIdSet.has(enrollment.program_id)) {
              return true
            }
            const status = enrollment.program?.status
            return (
              status === "draft" ||
              status === "active" ||
              status === "paused" ||
              status === "closed"
            )
          }
        )
        setEnrollments(openEnrollments)
      } else {
        console.warn("program_enrollments could not be loaded:", enrollmentsResult.error.message)
      }
    } catch (error) {
      console.error("Reports page error:", error)
      setTablesAvailable(false)
    } finally {
      setLoading(false)
    }
  }

  const filteredPrograms = React.useMemo(() => {
    if (departmentFilter === "all") return programs
    return programs.filter((program) => program.department_id === departmentFilter)
  }, [programs, departmentFilter])

  const filteredEnrollments = React.useMemo(() => {
    const query = searchQuery.toLowerCase()

    const filtered = enrollments.filter((enrollment) => {
      const program = enrollment.program || programs.find((item) => item.id === enrollment.program_id)
      const matchesSearch =
        !query ||
        enrollment.child_name.toLowerCase().includes(query) ||
        enrollment.parent_name?.toLowerCase().includes(query) ||
        enrollment.parent_email?.toLowerCase().includes(query) ||
        enrollment.id.toLowerCase().includes(query)

      const matchesDepartment =
        departmentFilter === "all" ||
        enrollment.department_id === departmentFilter ||
        program?.department_id === departmentFilter

      const matchesProgram = programFilter === "all" || enrollment.program_id === programFilter
      const matchesStatus = statusFilter === "all" || enrollment.status === statusFilter

      return matchesSearch && matchesDepartment && matchesProgram && matchesStatus
    })

    filtered.sort((a, b) => {
      let comparison = 0

      if (sortField === "child_name") comparison = a.child_name.localeCompare(b.child_name)
      else if (sortField === "total_amount") comparison = Number(a.total_amount || 0) - Number(b.total_amount || 0)
      else {
        comparison =
          new Date(a.enrollment_date || "1970-01-01").getTime() -
          new Date(b.enrollment_date || "1970-01-01").getTime()
      }

      return sortDirection === "asc" ? comparison : -comparison
    })

    return filtered
  }, [
    enrollments,
    programs,
    searchQuery,
    departmentFilter,
    programFilter,
    statusFilter,
    sortField,
    sortDirection,
  ])

  const overviewStats = React.useMemo(() => {
    const totalCapacity = programs.reduce((sum, program) => sum + Number(program.capacity || 0), 0)
    const totalEnrolled = programs.reduce((sum, program) => sum + Number(program.enrolled || 0), 0)
    const revenue = enrollments
      .filter((enrollment) => enrollment.status !== "cancelled")
      .reduce((sum, enrollment) => sum + Number(enrollment.amount_paid || 0), 0)
    const outstanding = enrollments
      .filter((enrollment) => enrollment.status !== "cancelled")
      .reduce(
        (sum, enrollment) =>
          sum + Math.max(Number(enrollment.total_amount || 0) - Number(enrollment.amount_paid || 0), 0),
        0
      )

    return {
      activePrograms: activeOfferingCount,
      totalCapacity,
      totalEnrolled,
      availableCapacity: Math.max(totalCapacity - totalEnrolled, 0),
      revenue,
      outstanding,
    }
  }, [programs, enrollments, activeOfferingCount])

  function handleSort(field: string) {
    if (sortField === field) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  function clearFilters() {
    setSearchQuery("")
    setDepartmentFilter("all")
    setProgramFilter("all")
    setStatusFilter("all")
  }

  function handleExport() {
    exportCsv(
      "program-enrollments.csv",
      filteredEnrollments.map((enrollment) => ({
        id: enrollment.id,
        child_name: enrollment.child_name,
        child_age: enrollment.child_age,
        parent_name: enrollment.parent_name,
        parent_email: enrollment.parent_email,
        program: enrollment.program?.name || "",
        enrollment_date: enrollment.enrollment_date,
        status: enrollment.status,
        payment_status: enrollment.payment_status,
        amount_paid: enrollment.amount_paid,
        total_amount: enrollment.total_amount,
      }))
    )
  }

  return (
    <>
      <Header title="Programs" />

      <ProgramsReportsNav />

      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
            <p className="text-muted-foreground">
              Program enrollment, attendance, and waitlist reporting.
            </p>
          </div>

          {activeTab === "overview" ? (
            <div className="flex flex-wrap items-center gap-2">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this-week">This Week</SelectItem>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="this-quarter">This Quarter</SelectItem>
                  <SelectItem value="this-year">This Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" onClick={handleExport}>
                <Download className="mr-2 size-4" />
                Export CSV
              </Button>
            </div>
          ) : null}
        </div>

        {!tablesAvailable && (
          <Card className="border-amber-500/50 bg-amber-500/10">
            <CardContent className="flex items-start gap-3 p-4 text-sm text-amber-700">
              <AlertCircle className="mt-0.5 size-5 shrink-0" />
              <div>
                Some report tables are not connected yet. Create the Supabase tables, then refresh
                this page.
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "overview" ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard
                title="Active Programs"
                value={overviewStats.activePrograms}
                icon={<FileText className="size-5" />}
                className="bg-blue-100 text-blue-600"
              />
              <SummaryCard
                title="Total Enrolled"
                value={overviewStats.totalEnrolled}
                icon={<Users className="size-5" />}
                className="bg-green-100 text-green-600"
              />
              <SummaryCard
                title="Revenue"
                value={formatCurrency(overviewStats.revenue)}
                icon={<DollarSign className="size-5" />}
                className="bg-purple-100 text-purple-600"
              />
              <SummaryCard
                title="Outstanding"
                value={formatCurrency(overviewStats.outstanding)}
                icon={<TrendingUp className="size-5" />}
                className="bg-amber-100 text-amber-600"
              />
            </div>
          </div>
        ) : null}

        {activeTab === "attendance" ? (
          <div className="space-y-6">
            <ProgramsAttendanceReportPanel />
          </div>
        ) : null}

        {activeTab === "waitlist" ? (
          <div className="space-y-6">
            <ProgramsWaitlistReportPanel />
          </div>
        ) : null}

        <Dialog
          open={!!messageDialog}
          onOpenChange={() => {
            setMessageDialog(null)
            setMessage("")
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Send Message to {messageDialog?.entry.parent_name}
              </DialogTitle>
              <DialogDescription>
                Draft a contact message. Sending can be connected to your email service later.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  defaultValue={`Regarding ${messageDialog?.entry.child_name}`}
                />
              </div>
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  placeholder="Type your message here..."
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={6}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setMessageDialog(null)
                  setMessage("")
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setMessageDialog(null)
                  setMessage("")
                }}
              >
                <Send className="mr-2 size-4" />
                Save Draft
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}

function SummaryCard({
  title,
  value,
  icon,
  className,
}: {
  title: string
  value: React.ReactNode
  icon: React.ReactNode
  className: string
}) {
  return (
    <Card className="h-full">
      <CardContent className="flex h-full items-center gap-4 p-4">
        <div className={cn("shrink-0 rounded-full p-3", className)}>{icon}</div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <div className="py-8 text-center text-sm text-muted-foreground">{children}</div>
}

function ReportFilters({
  searchQuery,
  setSearchQuery,
  departmentFilter,
  setDepartmentFilter,
  programFilter,
  setProgramFilter,
  statusFilter,
  setStatusFilter,
  departments,
  programs,
  statuses,
  clearFilters,
}: {
  searchQuery: string
  setSearchQuery: (value: string) => void
  departmentFilter: string
  setDepartmentFilter: (value: string) => void
  programFilter: string
  setProgramFilter: (value: string) => void
  statusFilter: string
  setStatusFilter: (value: string) => void
  departments: Department[]
  programs: Program[]
  statuses: [string, string][]
  clearFilters: () => void
}) {
  const hasFilters =
    searchQuery || departmentFilter !== "all" || programFilter !== "all" || statusFilter !== "all"

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col flex-wrap gap-4 sm:flex-row">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or ID..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-full sm:w-[210px]">
              <FolderOpen className="mr-2 size-4" />
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((department) => (
                <SelectItem key={department.id} value={department.id}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={programFilter} onValueChange={setProgramFilter}>
            <SelectTrigger className="w-full sm:w-[210px]">
              <SelectValue placeholder="Year/Season" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years/Seasons</SelectItem>
              {programs.map((program) => (
                <SelectItem key={program.id} value={program.id}>
                  {program.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {statuses.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button variant="ghost" size="icon" onClick={clearFilters}>
              <X className="size-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

