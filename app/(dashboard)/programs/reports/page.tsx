"use client"

import * as React from "react"
import { Header } from "@/components/layout/header"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

import {
  AlertCircle,
  ArrowUpDown,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  FileText,
  FolderOpen,
  HeartHandshake,
  Mail,
  MoreHorizontal,
  Phone,
  Receipt,
  Search,
  Send,
  TrendingUp,
  UserPlus,
  Users,
  X,
  XCircle,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

type ReportTab =
  | "overview"
  | "enrollment"
  | "waitlist"
  | "financial-assistance"
  | "payment-plans"
  | "expenses"
  | "care"
  | "attendance"

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

type WaitlistEntry = {
  id: string
  organization_id: string | null
  program_id: string | null
  child_name: string
  child_age: number | null
  parent_name: string | null
  parent_email: string | null
  parent_phone: string | null
  preferred_weeks: string[] | null
  added_date: string | null
  position: number | null
  status: "waiting" | "offered" | "expired" | "converted"
  priority: "normal" | "sibling" | "returning"
  offer_expiry: string | null
  notes: string | null
  program?: Program | null
}

type FinancialAssistance = {
  id: string
  enrollment_id: string | null
  status: "pending" | "approved" | "denied"
  requested_amount: number | null
  approved_amount: number | null
  notes: string | null
  enrollment?: Enrollment | null
}

type PaymentPlan = {
  id: string
  enrollment_id: string | null
  installment_amount: number | null
  due_date: string | null
  status: "pending" | "paid" | "late"
  paid_at: string | null
  enrollment?: Enrollment | null
}

type ProgramExpense = {
  id: string
  organization_id: string | null
  program_id: string | null
  department_id: string | null
  vendor: string | null
  category: string | null
  amount: number | null
  expense_date: string | null
  notes: string | null
  program?: Program | null
}

type ExtendedCare = {
  id: string
  enrollment_id: string | null
  care_date: string | null
  before_check_in: string | null
  after_check_out: string | null
  enrollment?: Enrollment | null
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

function getPercent(numerator: number, denominator: number) {
  if (!denominator || denominator <= 0) return 0
  return Math.min(Math.round((numerator / denominator) * 100), 100)
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
  const supabase = createClient()

  const [activeTab, setActiveTab] = React.useState<ReportTab>("overview")
  const [loading, setLoading] = React.useState(true)
  const [tablesAvailable, setTablesAvailable] = React.useState(true)

  const [programs, setPrograms] = React.useState<Program[]>([])
  const [departments, setDepartments] = React.useState<Department[]>([])
  const [enrollments, setEnrollments] = React.useState<Enrollment[]>([])
  const [waitlistEntries, setWaitlistEntries] = React.useState<WaitlistEntry[]>([])
  const [financialAssistance, setFinancialAssistance] = React.useState<FinancialAssistance[]>([])
  const [paymentPlans, setPaymentPlans] = React.useState<PaymentPlan[]>([])
  const [expenses, setExpenses] = React.useState<ProgramExpense[]>([])
  const [extendedCare, setExtendedCare] = React.useState<ExtendedCare[]>([])

  const [searchQuery, setSearchQuery] = React.useState("")
  const [departmentFilter, setDepartmentFilter] = React.useState("all")
  const [programFilter, setProgramFilter] = React.useState("all")
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [dateRange, setDateRange] = React.useState("this-month")
  const [sortField, setSortField] = React.useState("enrollment_date")
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc")

  const [selectedEnrollment, setSelectedEnrollment] = React.useState<Enrollment | null>(null)
  const [selectedWaitlist, setSelectedWaitlist] = React.useState<WaitlistEntry | null>(null)
  const [offerDialog, setOfferDialog] = React.useState<WaitlistEntry | null>(null)
  const [messageDialog, setMessageDialog] = React.useState<{
    type: "enrollment" | "waitlist"
    entry: Enrollment | WaitlistEntry
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
        waitlistResult,
        financialAssistanceResult,
        paymentPlansResult,
        expensesResult,
        extendedCareResult,
      ] = await Promise.all([
        supabase
          .from("programs")
          .select("id, name, description, department_id, capacity, enrolled, waitlist, status, start_date, end_date")
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
        supabase
          .from("program_waitlist")
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
          .order("position"),
        supabase
          .from("program_financial_assistance")
          .select(`
            *,
            enrollment:enrollment_id (
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
            )
          `),
        supabase
          .from("program_payment_plans")
          .select(`
            *,
            enrollment:enrollment_id (
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
            )
          `)
          .order("due_date"),
        supabase
          .from("program_expenses")
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
          .order("expense_date", { ascending: false }),
        supabase
          .from("program_extended_care")
          .select(`
            *,
            enrollment:enrollment_id (
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
            )
          `)
          .order("care_date", { ascending: false }),
      ])

      const missingTableErrors = [
        programsResult.error,
        departmentsResult.error,
        enrollmentsResult.error,
        waitlistResult.error,
        financialAssistanceResult.error,
        paymentPlansResult.error,
        expensesResult.error,
        extendedCareResult.error,
      ].filter((error) => error?.code === "42P01" || error?.code === "42703")

      setTablesAvailable(missingTableErrors.length === 0)

      if (!programsResult.error) setPrograms((programsResult.data || []) as Program[])
      else console.warn("programs could not be loaded:", programsResult.error.message)

      if (!departmentsResult.error) setDepartments((departmentsResult.data || []) as Department[])
      else console.warn("departments could not be loaded:", departmentsResult.error.message)

      if (!enrollmentsResult.error) setEnrollments((enrollmentsResult.data || []) as Enrollment[])
      else console.warn("program_enrollments could not be loaded:", enrollmentsResult.error.message)

      if (!waitlistResult.error) setWaitlistEntries((waitlistResult.data || []) as WaitlistEntry[])
      else console.warn("program_waitlist could not be loaded:", waitlistResult.error.message)

      if (!financialAssistanceResult.error) {
        setFinancialAssistance((financialAssistanceResult.data || []) as FinancialAssistance[])
      } else {
        console.warn("program_financial_assistance could not be loaded:", financialAssistanceResult.error.message)
      }

      if (!paymentPlansResult.error) setPaymentPlans((paymentPlansResult.data || []) as PaymentPlan[])
      else console.warn("program_payment_plans could not be loaded:", paymentPlansResult.error.message)

      if (!expensesResult.error) setExpenses((expensesResult.data || []) as ProgramExpense[])
      else console.warn("program_expenses could not be loaded:", expensesResult.error.message)

      if (!extendedCareResult.error) setExtendedCare((extendedCareResult.data || []) as ExtendedCare[])
      else console.warn("program_extended_care could not be loaded:", extendedCareResult.error.message)
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

  const filteredWaitlist = React.useMemo(() => {
    const query = searchQuery.toLowerCase()

    const filtered = waitlistEntries.filter((entry) => {
      const program = entry.program || programs.find((item) => item.id === entry.program_id)
      const matchesSearch =
        !query ||
        entry.child_name.toLowerCase().includes(query) ||
        entry.parent_name?.toLowerCase().includes(query) ||
        entry.parent_email?.toLowerCase().includes(query) ||
        entry.id.toLowerCase().includes(query)

      const matchesDepartment =
        departmentFilter === "all" || program?.department_id === departmentFilter

      const matchesProgram = programFilter === "all" || entry.program_id === programFilter
      const matchesStatus = statusFilter === "all" || entry.status === statusFilter

      return matchesSearch && matchesDepartment && matchesProgram && matchesStatus
    })

    filtered.sort((a, b) => {
      let comparison = 0

      if (sortField === "position") comparison = Number(a.position || 0) - Number(b.position || 0)
      else if (sortField === "child_name") comparison = a.child_name.localeCompare(b.child_name)
      else {
        comparison =
          new Date(a.added_date || "1970-01-01").getTime() -
          new Date(b.added_date || "1970-01-01").getTime()
      }

      return sortDirection === "asc" ? comparison : -comparison
    })

    return filtered
  }, [
    waitlistEntries,
    programs,
    searchQuery,
    departmentFilter,
    programFilter,
    statusFilter,
    sortField,
    sortDirection,
  ])

  const overviewStats = React.useMemo(() => {
    const activePrograms = programs.filter((program) => program.status === "active").length
    const totalCapacity = programs.reduce((sum, program) => sum + Number(program.capacity || 0), 0)
    const totalEnrolled = programs.reduce((sum, program) => sum + Number(program.enrolled || 0), 0)
    const waitlistTotal = waitlistEntries.filter((entry) => entry.status === "waiting").length
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
    const attendanceRate = getPercent(
      extendedCare.filter((care) => care.before_check_in || care.after_check_out).length,
      Math.max(extendedCare.length, 1)
    )

    return {
      activePrograms,
      totalCapacity,
      totalEnrolled,
      availableCapacity: Math.max(totalCapacity - totalEnrolled, 0),
      waitlistTotal,
      revenue,
      outstanding,
      attendanceRate,
    }
  }, [programs, enrollments, waitlistEntries, extendedCare])

  const enrollmentStats = React.useMemo(() => {
    return {
      total: filteredEnrollments.length,
      confirmed: filteredEnrollments.filter((enrollment) => enrollment.status === "confirmed").length,
      pending: filteredEnrollments.filter((enrollment) => enrollment.status === "pending").length,
      cancelled: filteredEnrollments.filter((enrollment) => enrollment.status === "cancelled").length,
      revenue: filteredEnrollments
        .filter((enrollment) => enrollment.status !== "cancelled")
        .reduce((sum, enrollment) => sum + Number(enrollment.amount_paid || 0), 0),
      totalCapacity: overviewStats.totalCapacity,
      totalEnrolled: overviewStats.totalEnrolled,
      availableCapacity: overviewStats.availableCapacity,
    }
  }, [filteredEnrollments, overviewStats])

  const waitlistStats = React.useMemo(() => {
    return {
      total: filteredWaitlist.length,
      waiting: filteredWaitlist.filter((entry) => entry.status === "waiting").length,
      offered: filteredWaitlist.filter((entry) => entry.status === "offered").length,
      expired: filteredWaitlist.filter((entry) => entry.status === "expired").length,
    }
  }, [filteredWaitlist])

  const revenueByDepartment = React.useMemo(() => {
    const departmentRevenue = new Map<string, number>()

    enrollments
      .filter((enrollment) => enrollment.status !== "cancelled")
      .forEach((enrollment) => {
        const program = enrollment.program || programs.find((item) => item.id === enrollment.program_id)
        const departmentId = enrollment.department_id || program?.department_id || "unassigned"
        departmentRevenue.set(
          departmentId,
          (departmentRevenue.get(departmentId) || 0) + Number(enrollment.amount_paid || 0)
        )
      })

    const total = Array.from(departmentRevenue.values()).reduce((sum, value) => sum + value, 0)

    return Array.from(departmentRevenue.entries()).map(([departmentId, amount]) => {
      const department = departments.find((item) => item.id === departmentId)

      return {
        id: departmentId,
        name: department?.name || "Unassigned",
        amount,
        percentage: total ? Math.round((amount / total) * 100) : 0,
      }
    })
  }, [enrollments, programs, departments])

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

  async function handleOfferSpot(entry: WaitlistEntry) {
    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + 7)

    const { error } = await supabase
      .from("program_waitlist")
      .update({
        status: "offered",
        offer_expiry: expiryDate.toISOString().slice(0, 10),
      })
      .eq("id", entry.id)

    if (error) {
      console.error("Offer spot error:", error)
      alert(error.message)
      return
    }

    setOfferDialog(null)
    await fetchReportsData()
  }

  function handleExport() {
    if (activeTab === "waitlist") {
      exportCsv(
        "program-waitlist.csv",
        filteredWaitlist.map((entry) => ({
          id: entry.id,
          child_name: entry.child_name,
          parent_name: entry.parent_name,
          parent_email: entry.parent_email,
          program: entry.program?.name || "",
          position: entry.position,
          status: entry.status,
          priority: entry.priority,
          added_date: entry.added_date,
        }))
      )
      return
    }

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

      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
            <p className="text-muted-foreground">
              Program analytics, enrollment reporting, and financial tracking.
            </p>
          </div>

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

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ReportTab)} className="space-y-6">
          <TabsList className="flex h-auto flex-wrap">
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="size-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="enrollment" className="gap-2">
              <FileText className="size-4" />
              Enrollment
              <Badge variant="secondary" className="ml-1">{enrollmentStats.total}</Badge>
            </TabsTrigger>
            <TabsTrigger value="waitlist" className="gap-2">
              <Users className="size-4" />
              Waitlist
              <Badge variant="secondary" className="ml-1">{waitlistStats.total}</Badge>
            </TabsTrigger>
            <TabsTrigger value="financial-assistance" className="gap-2">
              <HeartHandshake className="size-4" />
              Financial Assistance
            </TabsTrigger>
            <TabsTrigger value="payment-plans" className="gap-2">
              <CreditCard className="size-4" />
              Payment Plans
            </TabsTrigger>
            <TabsTrigger value="expenses" className="gap-2">
              <Receipt className="size-4" />
              Expenses
            </TabsTrigger>
            <TabsTrigger value="care" className="gap-2">
              <Clock className="size-4" />
              Before & After Care
            </TabsTrigger>
            <TabsTrigger value="attendance" className="gap-2">
              <Calendar className="size-4" />
              Attendance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
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
                title="Attendance"
                value={`${overviewStats.attendanceRate}%`}
                icon={<TrendingUp className="size-5" />}
                className="bg-amber-100 text-amber-600"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <QuickReport title="Enrollment Summary" description="Program enrollment details" icon={<FileText className="size-5" />} onClick={() => setActiveTab("enrollment")} />
              <QuickReport title="Revenue Report" description="Income by program and department" icon={<DollarSign className="size-5" />} onClick={() => setActiveTab("expenses")} />
              <QuickReport title="Attendance Report" description="Attendance and care tracking" icon={<Calendar className="size-5" />} onClick={() => setActiveTab("attendance")} />
              <QuickReport title="Financial Assistance" description="Applications and awards" icon={<HeartHandshake className="size-5" />} onClick={() => setActiveTab("financial-assistance")} />
              <QuickReport title="Payment Plans" description="Installments and balances" icon={<CreditCard className="size-5" />} onClick={() => setActiveTab("payment-plans")} />
              <QuickReport title="Waitlist Report" description="Queue and offer tracking" icon={<Users className="size-5" />} onClick={() => setActiveTab("waitlist")} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Revenue by Department</CardTitle>
                <CardDescription>Breakdown by program department.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {revenueByDepartment.length === 0 ? (
                  <EmptyText>No revenue data yet.</EmptyText>
                ) : (
                  revenueByDepartment.map((item) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="size-3 rounded-full bg-primary" />
                        <span className="text-sm font-medium">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">{item.percentage}%</span>
                        <span className="w-24 text-right font-medium">{formatCurrency(item.amount)}</span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

                <TabsContent value="enrollment" className="space-y-6">
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
    <MetricCard
      label="Total Capacity"
      value={enrollmentStats.totalCapacity}
    />

    <MetricCard
      label="Available"
      value={enrollmentStats.availableCapacity}
      valueClassName="text-emerald-500"
    />

    <MetricCard
      label="Enrolled"
      value={enrollmentStats.totalEnrolled}
      valueClassName="text-sky-500"
    />

    <MetricCard
      label="Confirmed"
      value={enrollmentStats.confirmed}
      valueClassName="text-emerald-500"
    />

    <MetricCard
      label="Pending"
      value={enrollmentStats.pending}
      valueClassName="text-amber-500"
    />
  </div>

  <ReportFilters
    searchQuery={searchQuery}
    setSearchQuery={setSearchQuery}
    departmentFilter={departmentFilter}
    setDepartmentFilter={(value) => {
      setDepartmentFilter(value)
      setProgramFilter("all")
    }}
    programFilter={programFilter}
    setProgramFilter={setProgramFilter}
    statusFilter={statusFilter}
    setStatusFilter={setStatusFilter}
    departments={departments}
    programs={filteredPrograms}
    statuses={[
      ["confirmed", "Confirmed"],
      ["pending", "Pending"],
      ["cancelled", "Cancelled"],
    ]}
    clearFilters={clearFilters}
  />

  <EnrollmentTable
    loading={loading}
    enrollments={filteredEnrollments}
    sortField={sortField}
    sortDirection={sortDirection}
    onSort={handleSort}
    onSelect={setSelectedEnrollment}
    onMessage={(enrollment) =>
      setMessageDialog({
        type: "enrollment",
        entry: enrollment,
      })
    }
  />
</TabsContent>
          
          <TabsContent value="waitlist" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <MetricCard label="Total Waitlisted" value={waitlistStats.total} />
              <MetricCard label="Waiting" value={waitlistStats.waiting} valueClassName="text-sky-500" />
              <MetricCard label="Spots Offered" value={waitlistStats.offered} valueClassName="text-violet-500" />
              <MetricCard label="Expired Offers" value={waitlistStats.expired} valueClassName="text-zinc-500" />
            </div>

            <ReportFilters
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              departmentFilter={departmentFilter}
              setDepartmentFilter={(value) => {
                setDepartmentFilter(value)
                setProgramFilter("all")
              }}
              programFilter={programFilter}
              setProgramFilter={setProgramFilter}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              departments={departments}
              programs={filteredPrograms}
              statuses={[
                ["waiting", "Waiting"],
                ["offered", "Offered"],
                ["expired", "Expired"],
                ["converted", "Converted"],
              ]}
              clearFilters={clearFilters}
            />

            <WaitlistTable
              loading={loading}
              entries={filteredWaitlist}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
              onSelect={setSelectedWaitlist}
              onMessage={(entry) => setMessageDialog({ type: "waitlist", entry })}
              onOffer={setOfferDialog}
            />
          </TabsContent>

          <TabsContent value="financial-assistance">
            <FinancialAssistanceSection items={financialAssistance} loading={loading} />
          </TabsContent>

          <TabsContent value="payment-plans">
            <PaymentPlansSection items={paymentPlans} loading={loading} />
          </TabsContent>

          <TabsContent value="expenses">
            <ExpensesSection items={expenses} loading={loading} />
          </TabsContent>

          <TabsContent value="care">
            <CareSection items={extendedCare} loading={loading} />
          </TabsContent>

          <TabsContent value="attendance">
            <AttendanceSection enrollments={enrollments} careItems={extendedCare} programs={programs} loading={loading} />
          </TabsContent>
        </Tabs>

        <EnrollmentSheet
          enrollment={selectedEnrollment}
          onOpenChange={() => setSelectedEnrollment(null)}
          onMessage={(enrollment) => setMessageDialog({ type: "enrollment", entry: enrollment })}
        />

        <WaitlistSheet
          entry={selectedWaitlist}
          onOpenChange={() => setSelectedWaitlist(null)}
          onMessage={(entry) => setMessageDialog({ type: "waitlist", entry })}
          onOffer={setOfferDialog}
        />

        <Dialog open={!!offerDialog} onOpenChange={() => setOfferDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Offer Spot to {offerDialog?.child_name}</DialogTitle>
              <DialogDescription>
                Mark this waitlist entry as offered. You can send the parent a message after updating the status.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 text-sm text-muted-foreground">
              The offer expiry will be set to 7 days from today.
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOfferDialog(null)}>
                Cancel
              </Button>
              <Button onClick={() => offerDialog && handleOfferSpot(offerDialog)}>
                Offer Spot
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                Send Message to{" "}
                {messageDialog?.type === "enrollment"
                  ? (messageDialog.entry as Enrollment).parent_name
                  : (messageDialog?.entry as WaitlistEntry)?.parent_name}
              </DialogTitle>
              <DialogDescription>
                Draft a parent message. Sending can be connected to your email service later.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  defaultValue={`Regarding ${
                    messageDialog?.type === "enrollment"
                      ? (messageDialog.entry as Enrollment).child_name
                      : (messageDialog?.entry as WaitlistEntry)?.child_name
                  }`}
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
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={cn("rounded-full p-3", className)}>{icon}</div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function QuickReport({
  title,
  description,
  icon,
  onClick,
}: {
  title: string
  description: string
  icon: React.ReactNode
  onClick: () => void
}) {
  return (
    <Card className="cursor-pointer transition-colors hover:bg-muted/50" onClick={onClick}>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="rounded-full bg-muted p-3 text-muted-foreground">{icon}</div>
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function MetricCard({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: React.ReactNode
  valueClassName?: string
}) {
  return (
    <Card className="min-w-0">
      <CardHeader className="space-y-2 p-5">
        <CardDescription className="text-sm">
          {label}
        </CardDescription>

        <CardTitle
          className={cn(
            "text-3xl font-bold tracking-tight",
            valueClassName
          )}
        >
          {value}
        </CardTitle>
      </CardHeader>
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
              <SelectValue placeholder="Program" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Programs</SelectItem>
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

function EnrollmentTable({
  loading,
  enrollments,
  sortField,
  sortDirection,
  onSort,
  onSelect,
  onMessage,
}: {
  loading: boolean
  enrollments: Enrollment[]
  sortField: string
  sortDirection: SortDirection
  onSort: (field: string) => void
  onSelect: (enrollment: Enrollment) => void
  onMessage: (enrollment: Enrollment) => void
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">ID</TableHead>
              <TableHead>
                <SortButton field="child_name" label="Child" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
              </TableHead>
              <TableHead>Parent</TableHead>
              <TableHead>Program</TableHead>
              <TableHead>Weeks</TableHead>
              <TableHead>
                <SortButton field="enrollment_date" label="Date" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>
                <SortButton field="total_amount" label="Amount" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
              </TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                  Loading enrollments...
                </TableCell>
              </TableRow>
            ) : enrollments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                  No enrollments found.
                </TableCell>
              </TableRow>
            ) : (
              enrollments.map((enrollment) => (
                <TableRow
                  key={enrollment.id}
                  className="cursor-pointer"
                  onClick={() => onSelect(enrollment)}
                >
                  <TableCell className="font-mono text-xs">{enrollment.id.slice(0, 8)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback>{getInitials(enrollment.child_name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{enrollment.child_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {enrollment.child_age ? `Age ${enrollment.child_age}` : "Age not set"}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{enrollment.parent_name || "-"}</div>
                    <div className="text-xs text-muted-foreground">{enrollment.parent_email || ""}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{enrollment.program?.name || "Unassigned"}</div>
                    <div className="text-xs text-muted-foreground">{enrollment.session_name || ""}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{enrollment.weeks?.length || 0} weeks</div>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(enrollment.enrollment_date)}</TableCell>
                  <TableCell>{getStatusBadge(enrollment.status)}</TableCell>
                  <TableCell>{getPaymentBadge(enrollment.payment_status)}</TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{formatCurrency(enrollment.total_amount)}</div>
                    {enrollment.payment_status === "partial" && (
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(enrollment.amount_paid)} paid
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(event) => {
                            event.stopPropagation()
                            onSelect(enrollment)
                          }}
                        >
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(event) => {
                            event.stopPropagation()
                            onMessage(enrollment)
                          }}
                        >
                          <Mail className="mr-2 size-4" />
                          Send Message
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
  )
}

function WaitlistTable({
  loading,
  entries,
  sortField,
  sortDirection,
  onSort,
  onSelect,
  onMessage,
  onOffer,
}: {
  loading: boolean
  entries: WaitlistEntry[]
  sortField: string
  sortDirection: SortDirection
  onSort: (field: string) => void
  onSelect: (entry: WaitlistEntry) => void
  onMessage: (entry: WaitlistEntry) => void
  onOffer: (entry: WaitlistEntry) => void
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">
                <SortButton field="position" label="#" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
              </TableHead>
              <TableHead>
                <SortButton field="child_name" label="Child" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
              </TableHead>
              <TableHead>Parent</TableHead>
              <TableHead>Program</TableHead>
              <TableHead>Preferred Weeks</TableHead>
              <TableHead>
                <SortButton field="added_date" label="Added" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
              </TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  Loading waitlist...
                </TableCell>
              </TableRow>
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  No waitlist entries found.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow key={entry.id} className="cursor-pointer" onClick={() => onSelect(entry)}>
                  <TableCell className="font-medium">{entry.position || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback>{getInitials(entry.child_name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{entry.child_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {entry.child_age ? `Age ${entry.child_age}` : "Age not set"}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{entry.parent_name || "-"}</div>
                    <div className="text-xs text-muted-foreground">{entry.parent_email || ""}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{entry.program?.name || "Unassigned"}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(entry.preferred_weeks || []).slice(0, 2).map((week) => (
                        <Badge key={week} variant="outline" className="text-xs">
                          {week}
                        </Badge>
                      ))}
                      {(entry.preferred_weeks || []).length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{(entry.preferred_weeks || []).length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(entry.added_date)}</TableCell>
                  <TableCell>{getPriorityBadge(entry.priority)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {getStatusBadge(entry.status)}
                      {entry.status === "offered" && entry.offer_expiry && (
                        <span className="text-xs text-muted-foreground">
                          Expires {formatDate(entry.offer_expiry)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(event) => {
                            event.stopPropagation()
                            onSelect(entry)
                          }}
                        >
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(event) => {
                            event.stopPropagation()
                            onMessage(entry)
                          }}
                        >
                          <Mail className="mr-2 size-4" />
                          Send Message
                        </DropdownMenuItem>
                        {entry.status === "waiting" && (
                          <DropdownMenuItem
                            className="text-emerald-600"
                            onClick={(event) => {
                              event.stopPropagation()
                              onOffer(entry)
                            }}
                          >
                            <UserPlus className="mr-2 size-4" />
                            Offer Spot
                          </DropdownMenuItem>
                        )}
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
  )
}

function EnrollmentSheet({
  enrollment,
  onOpenChange,
  onMessage,
}: {
  enrollment: Enrollment | null
  onOpenChange: () => void
  onMessage: (enrollment: Enrollment) => void
}) {
  return (
    <Sheet open={!!enrollment} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {enrollment && (
          <>
            <SheetHeader>
              <SheetTitle>Enrollment Details</SheetTitle>
              <SheetDescription>{enrollment.id}</SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="size-16">
                  <AvatarFallback className="text-lg">{getInitials(enrollment.child_name)}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">{enrollment.child_name}</h3>
                  <p className="text-muted-foreground">
                    {enrollment.child_age ? `Age ${enrollment.child_age}` : "Age not set"}
                  </p>
                  <div className="mt-1 flex gap-2">
                    {getStatusBadge(enrollment.status)}
                    {getPaymentBadge(enrollment.payment_status)}
                  </div>
                </div>
              </div>

              <InfoCard
                title="Parent Information"
                rows={[
                  ["Parent", enrollment.parent_name || "-"],
                  ["Email", enrollment.parent_email || "-"],
                  ["Phone", enrollment.parent_phone || "-"],
                ]}
              />

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Program Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <InfoRow label="Program" value={enrollment.program?.name || "Unassigned"} />
                  <InfoRow label="Session" value={enrollment.session_name || "-"} />
                  <div>
                    <div className="text-sm text-muted-foreground">Enrolled Weeks</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(enrollment.weeks || []).map((week) => (
                        <Badge key={week} variant="outline">
                          {week}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <InfoRow label="Enrollment Date" value={formatDate(enrollment.enrollment_date)} />
                </CardContent>
              </Card>

              <InfoCard
                title="Add-ons"
                rows={[
                  ["Before Care", enrollment.before_care ? "Yes" : "No"],
                  ["After Care", enrollment.after_care ? "Yes" : "No"],
                  ["Lunch", enrollment.lunch_type || "none"],
                ]}
              />

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Payment</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <InfoRow label="Total Amount" value={formatCurrency(enrollment.total_amount)} />
                  <InfoRow label="Amount Paid" value={formatCurrency(enrollment.amount_paid)} />
                  {enrollment.payment_status === "partial" && (
                    <>
                      <InfoRow
                        label="Remaining"
                        value={formatCurrency(Number(enrollment.total_amount || 0) - Number(enrollment.amount_paid || 0))}
                      />
                      <Progress
                        value={getPercent(Number(enrollment.amount_paid || 0), Number(enrollment.total_amount || 0))}
                        className="h-2"
                      />
                    </>
                  )}
                </CardContent>
              </Card>

              {enrollment.notes && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{enrollment.notes}</p>
                  </CardContent>
                </Card>
              )}

              <Button variant="outline" className="w-full" onClick={() => onMessage(enrollment)}>
                <Mail className="mr-2 size-4" />
                Message Parent
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function WaitlistSheet({
  entry,
  onOpenChange,
  onMessage,
  onOffer,
}: {
  entry: WaitlistEntry | null
  onOpenChange: () => void
  onMessage: (entry: WaitlistEntry) => void
  onOffer: (entry: WaitlistEntry) => void
}) {
  return (
    <Sheet open={!!entry} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {entry && (
          <>
            <SheetHeader>
              <SheetTitle>Waitlist Entry</SheetTitle>
              <SheetDescription>{entry.id}</SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="size-16">
                  <AvatarFallback className="text-lg">{getInitials(entry.child_name)}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">{entry.child_name}</h3>
                  <p className="text-muted-foreground">
                    {entry.child_age ? `Age ${entry.child_age}` : "Age not set"}
                  </p>
                  <div className="mt-1 flex gap-2">
                    {getStatusBadge(entry.status)}
                    {getPriorityBadge(entry.priority)}
                  </div>
                </div>
              </div>

              <Card>
                <CardContent className="pt-6 text-center">
                  <div className="text-4xl font-bold">#{entry.position || "-"}</div>
                  <div className="mt-1 text-sm text-muted-foreground">Position in waitlist</div>
                </CardContent>
              </Card>

              <InfoCard
                title="Parent Information"
                rows={[
                  ["Parent", entry.parent_name || "-"],
                  ["Email", entry.parent_email || "-"],
                  ["Phone", entry.parent_phone || "-"],
                ]}
              />

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Program Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <InfoRow label="Program" value={entry.program?.name || "Unassigned"} />
                  <div>
                    <div className="text-sm text-muted-foreground">Preferred Weeks</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(entry.preferred_weeks || []).map((week) => (
                        <Badge key={week} variant="outline">
                          {week}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <InfoRow label="Added to Waitlist" value={formatDate(entry.added_date)} />
                </CardContent>
              </Card>

              {entry.status === "offered" && entry.offer_expiry && (
                <Card className="border-violet-500/50 bg-violet-500/5">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 size-5 text-violet-500" />
                      <div>
                        <div className="font-medium">Spot Offered</div>
                        <div className="text-sm text-muted-foreground">
                          Offer expires on {formatDate(entry.offer_expiry)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {entry.notes && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{entry.notes}</p>
                  </CardContent>
                </Card>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => onMessage(entry)}>
                  <Mail className="mr-2 size-4" />
                  Message Parent
                </Button>
                {entry.status === "waiting" && (
                  <Button className="flex-1" onClick={() => onOffer(entry)}>
                    <UserPlus className="mr-2 size-4" />
                    Offer Spot
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function InfoCard({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map(([label, value]) => (
          <InfoRow key={label} label={label} value={value} />
        ))}
      </CardContent>
    </Card>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}

function FinancialAssistanceSection({
  items,
  loading,
}: {
  items: FinancialAssistance[]
  loading: boolean
}) {
  const totalRequested = items.reduce((sum, item) => sum + Number(item.requested_amount || 0), 0)
  const totalApproved = items.reduce((sum, item) => sum + Number(item.approved_amount || 0), 0)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Applications" value={items.length} />
        <MetricCard label="Requested" value={formatCurrency(totalRequested)} />
        <MetricCard label="Approved" value={formatCurrency(totalApproved)} valueClassName="text-emerald-500" />
      </div>

      <SimpleTable
        loading={loading}
        empty="No financial assistance applications found."
        headers={["Child", "Program", "Requested", "Approved", "Status"]}
        rows={items.map((item) => [
          item.enrollment?.child_name || "-",
          item.enrollment?.program?.name || "-",
          formatCurrency(item.requested_amount),
          formatCurrency(item.approved_amount),
          getStatusBadge(item.status),
        ])}
      />
    </div>
  )
}

function PaymentPlansSection({ items, loading }: { items: PaymentPlan[]; loading: boolean }) {
  const outstanding = items
    .filter((item) => item.status !== "paid")
    .reduce((sum, item) => sum + Number(item.installment_amount || 0), 0)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Installments" value={items.length} />
        <MetricCard label="Outstanding" value={formatCurrency(outstanding)} valueClassName="text-amber-500" />
        <MetricCard label="Late" value={items.filter((item) => item.status === "late").length} valueClassName="text-red-500" />
      </div>

      <SimpleTable
        loading={loading}
        empty="No payment plan installments found."
        headers={["Child", "Program", "Amount", "Due Date", "Status"]}
        rows={items.map((item) => [
          item.enrollment?.child_name || "-",
          item.enrollment?.program?.name || "-",
          formatCurrency(item.installment_amount),
          formatDate(item.due_date),
          getStatusBadge(item.status),
        ])}
      />
    </div>
  )
}

function ExpensesSection({ items, loading }: { items: ProgramExpense[]; loading: boolean }) {
  const totalExpenses = items.reduce((sum, item) => sum + Number(item.amount || 0), 0)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Expenses" value={items.length} />
        <MetricCard label="Total Spent" value={formatCurrency(totalExpenses)} />
        <MetricCard label="Vendors" value={new Set(items.map((item) => item.vendor).filter(Boolean)).size} />
      </div>

      <SimpleTable
        loading={loading}
        empty="No expenses found."
        headers={["Vendor", "Program", "Category", "Amount", "Date"]}
        rows={items.map((item) => [
          item.vendor || "-",
          item.program?.name || "-",
          item.category || "-",
          formatCurrency(item.amount),
          formatDate(item.expense_date),
        ])}
      />
    </div>
  )
}

function CareSection({ items, loading }: { items: ExtendedCare[]; loading: boolean }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Care Records" value={items.length} />
        <MetricCard label="Before Care" value={items.filter((item) => item.before_check_in).length} />
        <MetricCard label="After Care" value={items.filter((item) => item.after_check_out).length} />
      </div>

      <SimpleTable
        loading={loading}
        empty="No before or after care records found."
        headers={["Child", "Program", "Date", "Before Check-In", "After Check-Out"]}
        rows={items.map((item) => [
          item.enrollment?.child_name || "-",
          item.enrollment?.program?.name || "-",
          formatDate(item.care_date),
          item.before_check_in ? new Date(item.before_check_in).toLocaleTimeString() : "-",
          item.after_check_out ? new Date(item.after_check_out).toLocaleTimeString() : "-",
        ])}
      />
    </div>
  )
}

function AttendanceSection({
  enrollments,
  careItems,
  programs,
  loading,
}: {
  enrollments: Enrollment[]
  careItems: ExtendedCare[]
  programs: Program[]
  loading: boolean
}) {
  const programRows = programs.map((program) => {
    const programEnrollments = enrollments.filter((enrollment) => enrollment.program_id === program.id)
    const programCare = careItems.filter((item) => item.enrollment?.program_id === program.id)
    const attendance = getPercent(
      programCare.filter((item) => item.before_check_in || item.after_check_out).length,
      Math.max(programCare.length, 1)
    )

    return [program.name, String(programEnrollments.length), `${attendance}%`]
  })

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Overall Attendance"
          value={`${getPercent(
            careItems.filter((item) => item.before_check_in || item.after_check_out).length,
            Math.max(careItems.length, 1)
          )}%`}
        />
        <MetricCard label="Attendance Records" value={careItems.length} />
        <MetricCard label="Avg Program Enrollment" value={programs.length ? Math.round(enrollments.length / programs.length) : 0} />
      </div>

      <SimpleTable
        loading={loading}
        empty="No attendance data found."
        headers={["Program", "Enrollments", "Attendance"]}
        rows={programRows}
      />
    </div>
  )
}

function SimpleTable({
  loading,
  empty,
  headers,
  rows,
}: {
  loading: boolean
  empty: string
  headers: string[]
  rows: React.ReactNode[][]
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((header) => (
                <TableHead key={header}>{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={headers.length} className="py-10 text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={headers.length} className="py-10 text-center text-muted-foreground">
                  {empty}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => (
                <TableRow key={index}>
                  {row.map((cell, cellIndex) => (
                    <TableCell key={cellIndex}>{cell}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
