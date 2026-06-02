import Link from "next/link"
import {
  CheckCircle,
  Clock,
  DollarSign,
  Download,
  Eye,
  Search,
  Users,
  UserPlus,
} from "lucide-react"

import { Header } from "@/components/layout/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { createClient } from "@/lib/supabase/server"
import { getPrograms } from "@/lib/programs/program-queries"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  contactLabel,
  loadContactsByIds,
} from "@/lib/programs/registration-display-helpers"

type PageSearchParams = {
  q?: string
  program?: string
  payment?: string
  status?: string
  type?: string
}

type EnrollmentRow = {
  id: string
  organization_id: string | null
  program_id: string | null
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
  program_name: string
  participant_name: string
  registrant_name: string | null
  payer_name: string | null
  child_age: number | null
  parent_name: string | null
  parent_email: string | null
  parent_phone: string | null
  registered_date: string | null
  status: string | null
  payment_status: string | null
  amount_paid: number | null
  total_amount: number | null
  waitlist_position: number | null
}

function getValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function formatDate(value: string | null) {
  if (!value) return "TBD"

  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatCurrency(value: number | null) {
  if (!value || value <= 0) return "$0"

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value)
}

function normalizeStatus(value: string | null) {
  if (!value) return "Unknown"

  return value
    .split("_")
    .join(" ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function getPaymentBadgeVariant(paymentStatus: string | null) {
  const status = (paymentStatus || "").toLowerCase()

  if (status === "paid") return "default"
  if (status === "pending") return "destructive"
  if (status === "partial") return "outline"

  return "secondary"
}

function getStatusBadgeVariant(status: string | null, type: string) {
  const normalized = (status || "").toLowerCase()

  if (type === "waitlist") return "outline"
  if (normalized === "enrolled" || normalized === "active") return "default"
  if (normalized === "pending") return "outline"
  if (normalized === "cancelled" || normalized === "canceled") {
    return "destructive"
  }

  return "secondary"
}

function isThisMonth(value: string | null) {
  if (!value) return false

  const date = new Date(`${value}T00:00:00`)
  const now = new Date()

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  )
}

function matchesFilters(row: RegistrationRow, filters: PageSearchParams) {
  const query = (filters.q || "").trim().toLowerCase()
  const programFilter = filters.program || "all"
  const paymentFilter = filters.payment || "all"
  const statusFilter = filters.status || "all"
  const typeFilter = filters.type || "all"

  const matchesSearch =
    !query ||
    row.participant_name.toLowerCase().includes(query) ||
    (row.registrant_name || "").toLowerCase().includes(query) ||
    (row.payer_name || "").toLowerCase().includes(query) ||
    (row.parent_name || "").toLowerCase().includes(query) ||
    (row.parent_email || "").toLowerCase().includes(query) ||
    (row.parent_phone || "").toLowerCase().includes(query) ||
    row.program_name.toLowerCase().includes(query)

  const matchesProgram =
    programFilter === "all" || row.program_id === programFilter

  const matchesPayment =
    paymentFilter === "all" ||
    (row.payment_status || "none").toLowerCase() === paymentFilter

  const matchesStatus =
    statusFilter === "all" ||
    (row.status || "unknown").toLowerCase() === statusFilter

  const matchesType = typeFilter === "all" || row.type === typeFilter

  return (
    matchesSearch &&
    matchesProgram &&
    matchesPayment &&
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
    program: getValue(resolvedSearchParams?.program) || "all",
    payment: getValue(resolvedSearchParams?.payment) || "all",
    status: getValue(resolvedSearchParams?.status) || "all",
    type: getValue(resolvedSearchParams?.type) || "all",
  }

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  const programs = await getPrograms()
  const programIds = programs.map((program) => program.id)

  const programNameById = new Map(
    programs.map((program) => [program.id, program.name])
  )

  let enrollments: EnrollmentRow[] = []
  let waitlist: WaitlistRow[] = []
  let loadError: string | null = null

  if (programIds.length > 0 && organizationId) {
    const [enrollmentsResult, waitlistResult] = await Promise.all([
      supabase
        .from("program_enrollments")
        .select(
          `
          id,
          organization_id,
          program_id,
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
    ...enrollments.map((row) => ({
      id: row.id,
      type: "enrollment" as const,
      program_id: row.program_id,
      program_name:
        (row.program_id ? programNameById.get(row.program_id) : null) ||
        "Unknown Program",
      participant_name: contactLabel(
        row.participant_contact_id
          ? contactsById.get(row.participant_contact_id)
          : undefined,
        row.child_name
      ),
      registrant_name: row.registrant_contact_id
        ? contactLabel(contactsById.get(row.registrant_contact_id), row.parent_name)
        : row.parent_name,
      payer_name: row.payer_contact_id
        ? contactLabel(contactsById.get(row.payer_contact_id), row.parent_name)
        : row.parent_name,
      child_age: row.child_age,
      parent_name: row.parent_name,
      parent_email: row.parent_email,
      parent_phone: row.parent_phone,
      registered_date: row.enrollment_date || row.created_at,
      status: row.status,
      payment_status: row.payment_status,
      amount_paid: row.amount_paid,
      total_amount: row.total_amount,
      waitlist_position: null,
    })),
    ...waitlist.map((row) => ({
      id: row.id,
      type: "waitlist" as const,
      program_id: row.program_id,
      program_name:
        (row.program_id ? programNameById.get(row.program_id) : null) ||
        "Unknown Program",
      participant_name: row.child_name,
      registrant_name: row.parent_name,
      payer_name: row.parent_name,
      child_age: row.child_age,
      parent_name: row.parent_name,
      parent_email: row.parent_email,
      parent_phone: row.parent_phone,
      registered_date: row.added_date || row.created_at,
      status: row.status || "waiting",
      payment_status: null,
      amount_paid: null,
      total_amount: null,
      waitlist_position: row.position,
    })),
  ].sort((a, b) => {
    const aDate = a.registered_date ? new Date(a.registered_date).getTime() : 0
    const bDate = b.registered_date ? new Date(b.registered_date).getTime() : 0
    return bDate - aDate
  })

  const filteredRows = registrationRows.filter((row) =>
    matchesFilters(row, filters)
  )

  const totalRegistrations = enrollments.length
  const totalWaitlist = waitlist.length
  const thisMonthRegistrations = registrationRows.filter((row) =>
    isThisMonth(row.registered_date)
  ).length

  const pendingPaymentCount = enrollments.filter(
    (row) => (row.payment_status || "").toLowerCase() === "pending"
  ).length

  const revenue = enrollments.reduce(
    (total, row) => total + Number(row.amount_paid || 0),
    0
  )

  const paymentStatuses = Array.from(
    new Set(
      enrollments
        .map((row) => (row.payment_status || "").toLowerCase())
        .filter(Boolean)
    )
  ).sort()

  const statuses = Array.from(
    new Set(
      registrationRows
        .map((row) => (row.status || "").toLowerCase())
        .filter(Boolean)
    )
  ).sort()

  const stats = [
    {
      label: "Enrollments",
      value: String(totalRegistrations),
      icon: Users,
      color: "text-blue-600",
    },
    {
      label: "Waitlist",
      value: String(totalWaitlist),
      icon: UserPlus,
      color: "text-orange-600",
    },
    {
      label: "This Month",
      value: String(thisMonthRegistrations),
      icon: CheckCircle,
      color: "text-green-600",
    },
    {
      label: "Pending Payment",
      value: String(pendingPaymentCount),
      icon: Clock,
      color: "text-amber-600",
    },
    {
      label: "Revenue Collected",
      value: formatCurrency(revenue),
      icon: DollarSign,
      color: "text-purple-600",
    },
  ]

  return (
    <>
      <Header title="Programs" />

      <div className="p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Registrations
            </h2>
            <p className="text-sm text-muted-foreground">
              View real program enrollments and waitlist entries.
            </p>
          </div>

          <Button variant="outline" disabled>
            <Download className="mr-2 h-4 w-4" />
            Export Coming Soon
          </Button>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className={`rounded-full bg-muted p-3 ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold text-foreground">
                    {stat.value}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mb-6">
          <CardContent className="p-4">
            <form className="grid gap-4 lg:grid-cols-6">
  <div className="relative lg:col-span-2">
    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

    <Input
      name="q"
      defaultValue={filters.q}
      placeholder="Search by participant, parent, email, phone, or program..."
      className="pl-9"
    />
  </div>

  <select
    name="program"
    defaultValue={filters.program}
    className="h-10 rounded-md border bg-background px-3 text-sm"
  >
    <option value="all">All Programs</option>

    {programs.map((program) => (
      <option key={program.id} value={program.id}>
        {program.name}
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

  <select
    name="payment"
    defaultValue={filters.payment}
    className="h-10 rounded-md border bg-background px-3 text-sm"
  >
    <option value="all">All Payments</option>

    {paymentStatuses.map((status) => (
      <option key={status} value={status}>
        {normalizeStatus(status)}
      </option>
    ))}

    <option value="none">No Payment</option>
  </select>

  <div className="flex gap-4">
    <select
      name="status"
      defaultValue={filters.status}
      className="h-10 flex-1 rounded-md border bg-background px-3 text-sm"
    >
      <option value="all">All Statuses</option>

      {statuses.map((status) => (
        <option key={status} value={status}>
          {normalizeStatus(status)}
        </option>
      ))}
    </select>

    <Button type="submit">Apply</Button>
  </div>
</form>
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
        ) : filteredRows.length === 0 ? (
          <Card>
            <CardContent className="flex min-h-[220px] flex-col items-center justify-center p-8 text-center">
              <Users className="mb-4 h-10 w-10 text-muted-foreground" />
              <h3 className="font-semibold">No registrations found</h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Customer enrollments and waitlist entries will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Participant</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[90px]">Type</TableHead>
                    <TableHead className="w-[90px]" />
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredRows.map((row) => (
                    <TableRow key={`${row.type}-${row.id}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">
                            {row.participant_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.child_age !== null && row.child_age !== undefined
                              ? `Age ${row.child_age}`
                              : "Age not set"}
                          </p>
                          {row.waitlist_position ? (
                            <p className="text-xs text-muted-foreground">
                              Waitlist position #{row.waitlist_position}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div>
                          <p className="text-sm text-foreground">
                            {row.parent_name || "Parent not set"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.parent_email || "No email"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.parent_phone || "No phone"}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>
                        {row.program_id ? (
                          <Link
                            href={`/programs/${row.program_id}`}
                            className="text-primary hover:underline"
                          >
                            {row.program_name}
                          </Link>
                        ) : (
                          <span>{row.program_name}</span>
                        )}
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        {formatDate(row.registered_date)}
                      </TableCell>

                      <TableCell className="font-medium">
                        {row.type === "waitlist"
                          ? "N/A"
                          : formatCurrency(row.total_amount)}
                      </TableCell>

                      <TableCell>
                        {row.type === "waitlist" ? (
                          <Badge variant="secondary">N/A</Badge>
                        ) : (
                          <Badge
                            variant={getPaymentBadgeVariant(row.payment_status)}
                          >
                            {normalizeStatus(row.payment_status)}
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant={getStatusBadgeVariant(row.status, row.type)}
                        >
                          {normalizeStatus(row.status)}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant={
                            row.type === "enrollment" ? "default" : "outline"
                          }
                        >
                          {row.type === "enrollment" ? "Enrolled" : "Waitlist"}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        {row.program_id ? (
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={`/programs/${row.program_id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
