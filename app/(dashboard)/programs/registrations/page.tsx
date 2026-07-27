import Link from "next/link"
import { Suspense } from "react"
import {
  CheckCircle,
  Clock,
  DollarSign,
  Download,
  Printer,
  Search,
  Users,
  UserPlus,
} from "lucide-react"

import { Header } from "@/components/layout/header"
import { ProgramsRegistrationsTable } from "@/components/programs/programs-registrations-table"
import { ProgramsReportsNav } from "@/components/programs/programs-reports-nav"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

import { getDepartments } from "@/lib/departments/department-queries"
import { createClient } from "@/lib/supabase/server"
import { getOpenPrograms } from "@/lib/programs/program-queries"
import {
  PROGRAM_LABEL,
  PROGRAM_LABEL_PLURAL,
  YEAR_SEASON_LABEL,
} from "@/lib/programs/program-display-labels"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  contactLabel,
  isTerminalEnrollmentStatus,
  loadContactsByIds,
  shouldShowEnrollmentPaymentStatus,
} from "@/lib/programs/registration-display-helpers"

type PageSearchParams = {
  q?: string
  department?: string
  offering?: string
  status?: string
  type?: string
}

type EnrollmentRow = {
  id: string
  organization_id: string | null
  program_id: string | null
  offering_id: string | null
  department_id: string | null
  child_name: string
  child_age: number | null
  parent_name: string | null
  parent_email: string | null
  parent_phone: string | null
  participant_contact_id: string | null
  registrant_contact_id: string | null
  payer_contact_id: string | null
  participant_type: string | null
  registrant_type: string | null
  enrollment_date: string | null
  status: string | null
  payment_status: string | null
  amount_paid: number | null
  total_amount: number | null
  notes: string | null
  created_at: string | null
}

type WaitlistRow = {
  id: string
  organization_id: string | null
  program_id: string | null
  child_name: string
  child_age: number | null
  parent_name: string | null
  parent_email: string | null
  parent_phone: string | null
  added_date: string | null
  position: number | null
  status: string | null
  priority: string | null
  created_at: string | null
}

type RegistrationRow = {
  id: string
  type: "enrollment" | "waitlist"
  program_id: string | null
  offering_id: string | null
  department_id: string | null
  program_name: string
  offering_name: string
  participant_name: string
  participant_contact_id: string | null
  contact_name: string
  contact_profile_id: string | null
  contact_email: string | null
  contact_phone: string | null
  child_age: number | null
  registered_date: string | null
  status: string | null
  payment_status: string | null
  amount_paid: number | null
  total_amount: number | null
  waitlist_position: number | null
  notes: string | null
}

function getValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function formatDate(value: string | null) {
  if (!value) return "TBD"

  const date = value.includes("T")
    ? new Date(value)
    : new Date(`${value}T00:00:00`)

  if (Number.isNaN(date.getTime())) return "TBD"

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatCurrency(value: number | null | undefined) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount) || amount <= 0) return "$0.00"

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

function outstandingBalance(
  totalAmount: number | null | undefined,
  amountPaid: number | null | undefined
) {
  const total = Number(totalAmount || 0)
  const paid = Number(amountPaid || 0)
  return Math.max(0, total - paid)
}

/** Balance status for registration fees: Paid / Open / Refunded. */
function resolveBalanceStatus(
  paymentStatus: string | null | undefined,
  amountPaid: number | null | undefined,
  totalAmount: number | null | undefined
): "paid" | "open" | "refunded" {
  const raw = (paymentStatus || "").toLowerCase().trim()
  if (raw === "refunded") return "refunded"

  // Prefer actual fee vs received — stale payment_status (e.g. still "paid" after a void)
  // must not hide open balances from the Status filter.
  const balance = outstandingBalance(totalAmount, amountPaid)
  if (balance <= 0.009) return "paid"
  if (raw === "waived") return "paid"
  return "open"
}

function formatBalanceStatus(status: "paid" | "open" | "refunded") {
  if (status === "paid") return "Paid"
  if (status === "open") return "Open"
  return "Refunded"
}

function getBalanceStatusBadgeVariant(status: "paid" | "open" | "refunded") {
  if (status === "paid") return "default"
  if (status === "open") return "outline"
  return "secondary"
}

function isThisMonth(value: string | null) {
  if (!value) return false

  const date = value.includes("T")
    ? new Date(value)
    : new Date(`${value}T00:00:00`)
  const now = new Date()

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  )
}

function isAdultEnrollment(row: EnrollmentRow) {
  const participantType = (row.participant_type || "").toLowerCase()
  const registrantType = (row.registrant_type || "").toLowerCase()
  return (
    participantType === "adult" ||
    registrantType === "adult_self" ||
    registrantType === "adult"
  )
}

function hasActiveFilters(filters: PageSearchParams) {
  return Boolean(
    (filters.q || "").trim() ||
      (filters.department && filters.department !== "all") ||
      (filters.offering && filters.offering !== "all") ||
      (filters.status && filters.status !== "all") ||
      (filters.type && filters.type !== "all")
  )
}

function matchesFilters(row: RegistrationRow, filters: PageSearchParams) {
  const query = (filters.q || "").trim().toLowerCase()
  const departmentFilter = (filters.department || "all").toLowerCase()
  const offeringFilter = filters.offering || "all"
  const statusFilter = (filters.status || "all").toLowerCase()
  const typeFilter = filters.type || "all"

  const matchesSearch =
    !query ||
    row.participant_name.toLowerCase().includes(query) ||
    row.contact_name.toLowerCase().includes(query) ||
    (row.contact_email || "").toLowerCase().includes(query) ||
    (row.contact_phone || "").toLowerCase().includes(query) ||
    row.offering_name.toLowerCase().includes(query) ||
    row.program_name.toLowerCase().includes(query)

  const matchesDepartment =
    departmentFilter === "all" ||
    (row.department_id || "").toLowerCase() === departmentFilter

  const matchesOffering =
    offeringFilter === "all" || row.offering_id === offeringFilter

  const balanceStatus = resolveBalanceStatus(
    row.payment_status,
    row.amount_paid,
    row.total_amount
  )

  // Open matches the Open Balances KPI: active enrollments still owing.
  const matchesStatus =
    statusFilter === "all" ||
    (row.type === "enrollment" &&
      balanceStatus === statusFilter &&
      (statusFilter !== "open" || !isTerminalEnrollmentStatus(row.status)))

  const matchesType = typeFilter === "all" || row.type === typeFilter

  return (
    matchesSearch &&
    matchesDepartment &&
    matchesOffering &&
    matchesStatus &&
    matchesType
  )
}

export default async function ProgramsRegistrationsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const resolvedSearchParams = await searchParams

  const filters: PageSearchParams = {
    q: getValue(resolvedSearchParams?.q),
    department: getValue(resolvedSearchParams?.department) || "all",
    offering: getValue(resolvedSearchParams?.offering) || "all",
    status: getValue(resolvedSearchParams?.status) || "all",
    type: getValue(resolvedSearchParams?.type) || "all",
  }

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  const [programs, departments] = await Promise.all([
    getOpenPrograms(),
    getDepartments(),
  ])
  const programIds = programs.map((program) => program.id)

  const programNameById = new Map(
    programs.map((program) => [program.id, program.name])
  )
  const programDepartmentById = new Map(
    programs.map((program) => [
      program.id,
      (program.department_id as string | null) || null,
    ])
  )

  let enrollments: EnrollmentRow[] = []
  let waitlist: WaitlistRow[] = []
  let loadError: string | null = null
  const offeringNameById = new Map<string, string>()
  const offeringMeta: Array<{
    id: string
    name: string
    programId: string
    departmentId: string | null
    status: string
  }> = []

  if (programIds.length > 0 && organizationId) {
    const [enrollmentsResult, waitlistResult, offeringsResult] =
      await Promise.all([
        supabase
          .from("program_enrollments")
          .select(
            `
          id,
          organization_id,
          program_id,
          offering_id,
          department_id,
          child_name,
          child_age,
          parent_name,
          parent_email,
          parent_phone,
          participant_contact_id,
          registrant_contact_id,
          payer_contact_id,
          participant_type,
          registrant_type,
          enrollment_date,
          status,
          payment_status,
          amount_paid,
          total_amount,
          notes,
          created_at
        `
          )
          .eq("organization_id", organizationId)
          .in("program_id", programIds)
          .order("created_at", { ascending: false }),
        supabase
          .from("program_waitlist")
          .select(
            `
          id,
          organization_id,
          program_id,
          child_name,
          child_age,
          parent_name,
          parent_email,
          parent_phone,
          added_date,
          position,
          status,
          priority,
          created_at
        `
          )
          .eq("organization_id", organizationId)
          .in("program_id", programIds)
          .order("created_at", { ascending: false }),
        supabase
          .from("program_offerings")
          .select("id, name, program_id, status")
          .eq("organization_id", organizationId)
          .in("program_id", programIds)
          .neq("status", "archived")
          .order("name", { ascending: true }),
      ])

    if (enrollmentsResult.error) {
      loadError = enrollmentsResult.error.message
    } else {
      enrollments = (enrollmentsResult.data || []) as EnrollmentRow[]
    }

    if (waitlistResult.error) {
      loadError = waitlistResult.error.message
    } else {
      waitlist = (waitlistResult.data || []) as WaitlistRow[]
    }

    for (const offering of offeringsResult.data || []) {
      const id = offering.id as string
      const programId = offering.program_id as string
      const name = (offering.name as string) || PROGRAM_LABEL
      offeringNameById.set(id, name)
      offeringMeta.push({
        id,
        name,
        programId,
        departmentId: programDepartmentById.get(programId) || null,
        status: (offering.status as string) || "active",
      })
    }
  }

  const contactIds = enrollments.flatMap((row) => [
    row.participant_contact_id,
    row.registrant_contact_id,
    row.payer_contact_id,
  ])

  const contactsById = organizationId
    ? await loadContactsByIds(organizationId, contactIds as string[])
    : new Map()

  const registrationRows: RegistrationRow[] = [
    ...enrollments.map((row) => {
      const participantName = contactLabel(
        row.participant_contact_id
          ? contactsById.get(row.participant_contact_id)
          : undefined,
        row.child_name
      )
      const participantContact = row.participant_contact_id
        ? contactsById.get(row.participant_contact_id)
        : undefined
      const registrantContact = row.registrant_contact_id
        ? contactsById.get(row.registrant_contact_id)
        : undefined
      const adult = isAdultEnrollment(row)
      const contactName = adult
        ? participantName
        : contactLabel(registrantContact, row.parent_name) ||
          row.parent_name ||
          "Contact not set"
      const contactEmail = adult
        ? (participantContact?.email as string | null | undefined) ||
          row.parent_email
        : row.parent_email ||
          (registrantContact?.email as string | null | undefined) ||
          null
      const contactPhone = adult
        ? (participantContact?.phone as string | null | undefined) ||
          row.parent_phone
        : row.parent_phone ||
          (registrantContact?.phone as string | null | undefined) ||
          null

      const departmentId =
        row.department_id ||
        (row.program_id ? programDepartmentById.get(row.program_id) : null) ||
        null

      const offeringName = row.offering_id
        ? offeringNameById.get(row.offering_id) || PROGRAM_LABEL
        : (row.program_id ? programNameById.get(row.program_id) : null) ||
          "Unknown offering"

      return {
        id: row.id,
        type: "enrollment" as const,
        program_id: row.program_id,
        offering_id: row.offering_id,
        department_id: departmentId,
        program_name:
          (row.program_id ? programNameById.get(row.program_id) : null) ||
          `Unknown ${YEAR_SEASON_LABEL}`,
        offering_name: offeringName,
        participant_name: participantName,
        participant_contact_id: row.participant_contact_id,
        contact_name: contactName,
        contact_profile_id: adult
          ? row.participant_contact_id
          : row.registrant_contact_id,
        contact_email: contactEmail || null,
        contact_phone: contactPhone || null,
        child_age: row.child_age,
        registered_date: row.enrollment_date || row.created_at,
        status: row.status,
        payment_status: row.payment_status,
        amount_paid: row.amount_paid,
        total_amount: row.total_amount,
        waitlist_position: null,
        notes: row.notes,
      }
    }),
    ...waitlist.map((row) => ({
      id: row.id,
      type: "waitlist" as const,
      program_id: row.program_id,
      offering_id: null,
      department_id: row.program_id
        ? programDepartmentById.get(row.program_id) || null
        : null,
      program_name:
        (row.program_id ? programNameById.get(row.program_id) : null) ||
        `Unknown ${YEAR_SEASON_LABEL}`,
      offering_name:
        (row.program_id ? programNameById.get(row.program_id) : null) ||
        `Unknown ${PROGRAM_LABEL.toLowerCase()}`,
      participant_name: row.child_name,
      participant_contact_id: null,
      contact_name: row.parent_name || "Contact not set",
      contact_profile_id: null,
      contact_email: row.parent_email,
      contact_phone: row.parent_phone,
      child_age: row.child_age,
      registered_date: row.added_date || row.created_at,
      status: row.status || "waiting",
      payment_status: "none",
      amount_paid: null,
      total_amount: null,
      waitlist_position: row.position,
      notes: null,
    })),
  ].sort((a, b) => {
    const aDate = a.registered_date ? new Date(a.registered_date).getTime() : 0
    const bDate = b.registered_date ? new Date(b.registered_date).getTime() : 0
    return bDate - aDate
  })

  const filteredRows = registrationRows.filter((row) =>
    matchesFilters(row, filters)
  )

  const activeEnrollmentCount = enrollments.filter(
    (row) => !isTerminalEnrollmentStatus(row.status)
  ).length
  const totalWaitlist = waitlist.length
  const thisMonthRegistrations = registrationRows.filter((row) =>
    isThisMonth(row.registered_date)
  ).length

  const openBalanceCount = enrollments.filter(
    (row) =>
      !isTerminalEnrollmentStatus(row.status) &&
      resolveBalanceStatus(row.payment_status, row.amount_paid, row.total_amount) ===
        "open"
  ).length

  const revenue = enrollments.reduce(
    (total, row) => total + Number(row.amount_paid || 0),
    0
  )

  const statuses = ["open", "paid", "refunded"] as const

  const departmentFilter = filters.department || "all"
  const offeringsForSelect =
    departmentFilter === "all"
      ? offeringMeta.filter(
          (o) =>
            o.status === "active" ||
            o.status === "draft" ||
            o.status === "closed"
        )
      : offeringMeta.filter((o) => (o.departmentId || "") === departmentFilter)

  const stats = [
    {
      label: "Active Enrollment",
      value: String(activeEnrollmentCount),
      icon: Users,
      color: "text-blue-600",
      href: null as string | null,
    },
    {
      label: "Waitlist",
      value: String(totalWaitlist),
      icon: UserPlus,
      color: "text-orange-600",
      href: "/programs/registrations?type=waitlist",
    },
    {
      label: "This Month",
      value: String(thisMonthRegistrations),
      icon: CheckCircle,
      color: "text-green-600",
      href: null as string | null,
    },
    {
      label: "Open Balances",
      value: String(openBalanceCount),
      icon: Clock,
      color: "text-amber-600",
      // Clear search/other filters so the table matches this KPI.
      href: "/programs/registrations?status=open",
    },
    {
      label: "Revenue Collected",
      value: formatCurrency(revenue),
      icon: DollarSign,
      color: "text-purple-600",
      href: null as string | null,
    },
  ]

  const filtersActive = hasActiveFilters(filters)

  return (
    <>
      <Header title="Programs" />

      <Suspense fallback={null}>
        <ProgramsReportsNav />
      </Suspense>

      <div className="p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Registrations
            </h2>
            <p className="text-sm text-muted-foreground">
              View program enrollment fees, payments received, and balances.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {filters.offering && filters.offering !== "all" ? (
              <Button variant="outline" asChild>
                <Link
                  href={`/programs/${
                    offeringMeta.find((o) => o.id === filters.offering)?.programId ||
                    ""
                  }/car-tags`}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Print Car Tags
                </Link>
              </Button>
            ) : null}
            <Button variant="outline" disabled>
              <Download className="mr-2 h-4 w-4" />
              Export Coming Soon
            </Button>
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {stats.map((stat) => {
            const content = (
              <CardContent className="flex h-full items-center gap-4 p-4">
                <div className={`rounded-full bg-muted p-3 ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold text-foreground">
                    {stat.value}
                  </p>
                </div>
              </CardContent>
            )
            return (
              <Card key={stat.label} className="h-full">
                {stat.href ? (
                  <Link
                    href={stat.href}
                    className="block h-full rounded-lg transition-colors hover:bg-muted/40"
                    title={`Show ${stat.label.toLowerCase()}`}
                  >
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </Card>
            )
          })}
        </div>

        <Card className="mb-6">
          <CardContent className="p-4">
            <form method="get" className="grid gap-4 lg:grid-cols-6">
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  name="q"
                  defaultValue={filters.q}
                  placeholder="Search by participant, contact, email, phone, or offering..."
                  className="pl-9"
                />
              </div>

              <select
                name="department"
                defaultValue={filters.department}
                className="h-10 rounded-md border bg-background px-3 text-sm"
              >
                <option value="all">All Departments</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>

              <select
                name="offering"
                defaultValue={filters.offering}
                className="h-10 rounded-md border bg-background px-3 text-sm"
              >
                <option value="all">All {PROGRAM_LABEL_PLURAL}</option>
                {offeringsForSelect.map((offering) => (
                  <option key={offering.id} value={offering.id}>
                    {offering.name}
                    {programNameById.get(offering.programId)
                      ? ` · ${programNameById.get(offering.programId)}`
                      : ""}
                  </option>
                ))}
              </select>

              <select
                name="type"
                defaultValue={filters.type}
                className="h-10 rounded-md border bg-background px-3 text-sm"
              >
                <option value="all">All Types</option>
                <option value="enrollment">Enrollments</option>
                <option value="waitlist">Waitlist</option>
              </select>

              <div className="flex gap-4">
                <select
                  name="status"
                  defaultValue={(filters.status || "all").toLowerCase()}
                  className="h-10 flex-1 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="all">All Statuses</option>
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {formatBalanceStatus(status)}
                    </option>
                  ))}
                </select>
                <Button type="submit">Apply</Button>
              </div>
            </form>
            {filtersActive ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                <p>
                  Showing {filteredRows.length}{" "}
                  {filteredRows.length === 1 ? "result" : "results"}
                  {(filters.status || "").toLowerCase() === "open" &&
                  openBalanceCount > filteredRows.length
                    ? ` (${openBalanceCount} open balances total)`
                    : null}
                </p>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/programs/registrations">Clear filters</Link>
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {loadError ? (
          <Card>
            <CardContent className="flex min-h-[220px] flex-col items-center justify-center p-8 text-center">
              <Users className="mb-4 h-10 w-10 text-muted-foreground" />
              <h3 className="font-semibold">Unable to load registrations</h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                {loadError}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <ProgramsRegistrationsTable
                emptyMessage="No registrations found"
                emptyDescription={
                  filtersActive
                    ? "Try clearing filters, or registrations will appear here after enrollment."
                    : "Registrations for open years will appear here after enrollment."
                }
                rows={filteredRows.map((row) => {
                  const balance =
                    row.type === "waitlist"
                      ? null
                      : outstandingBalance(row.total_amount, row.amount_paid)
                  const balanceStatus =
                    row.type === "waitlist" ||
                    !shouldShowEnrollmentPaymentStatus(row.status)
                      ? null
                      : resolveBalanceStatus(
                          row.payment_status,
                          row.amount_paid,
                          row.total_amount
                        )

                  return {
                    id: row.id,
                    type: row.type,
                    participantName: row.participant_name,
                    participantContactId: row.participant_contact_id,
                    contactName: row.contact_name,
                    contactProfileId: row.contact_profile_id,
                    contactEmail: row.contact_email,
                    contactPhone: row.contact_phone,
                    childAge: row.child_age,
                    waitlistPosition: row.waitlist_position,
                    offeringName: row.offering_name,
                    registeredDateLabel: formatDate(row.registered_date),
                    feeLabel:
                      row.type === "waitlist"
                        ? "N/A"
                        : formatCurrency(row.total_amount),
                    receivedLabel:
                      row.type === "waitlist"
                        ? "N/A"
                        : formatCurrency(row.amount_paid),
                    balanceLabel:
                      row.type === "waitlist"
                        ? "N/A"
                        : formatCurrency(balance),
                    statusLabel: balanceStatus
                      ? formatBalanceStatus(balanceStatus)
                      : null,
                    statusVariant: balanceStatus
                      ? getBalanceStatusBadgeVariant(balanceStatus)
                      : "secondary",
                    enrollmentStatus: row.status,
                    totalAmount: row.total_amount ?? 0,
                    amountPaid: row.amount_paid ?? 0,
                    notes: row.notes,
                  }
                })}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
