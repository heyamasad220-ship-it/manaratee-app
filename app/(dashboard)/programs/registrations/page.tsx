import Link from "next/link"
import { Suspense } from "react"
import {
  Download,
  Users,
} from "lucide-react"

import { Header } from "@/components/layout/header"
import { ProgramsRegistrationsTable } from "@/components/programs/programs-registrations-table"
import { ProgramsReportsNav } from "@/components/programs/programs-reports-nav"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

import { createClient } from "@/lib/supabase/server"
import { getDepartments } from "@/lib/departments/department-queries"
import { getOpenPrograms } from "@/lib/programs/program-queries"
import {
  PROGRAM_LABEL,
  YEAR_SEASON_LABEL,
} from "@/lib/programs/program-display-labels"
import {
  normalizeProgramKind,
  type ProgramKind,
} from "@/lib/programs/program-kind"
import { isOfferingCurrentlyActive } from "@/lib/programs/program-offering-display"
import {
  buildEnrollmentFeeBreakdown,
  type AdditionalFeeItem,
  type RegistrationChargeInput,
  type RegistrationFeeLineInput,
} from "@/lib/programs/registration-report-helpers"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  contactLabel,
  isTerminalEnrollmentStatus,
  loadContactsByIds,
} from "@/lib/programs/registration-display-helpers"

type PageSearchParams = {
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
  child_person_id: string | null
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
  cancelled_at: string | null
  withdrawn_at: string | null
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
  offering_activity: "active" | "closed"
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
  registration_fee: number | null
  additional_fees: AdditionalFeeItem[]
  cancellation_date: string | null
  cancelled_by: string | null
}

async function fetchByIdChunks<T>(
  ids: string[],
  fetchChunk: (chunk: string[]) => Promise<T[]>
): Promise<T[]> {
  if (ids.length === 0) return []
  const rows: T[] = []
  const chunkSize = 150
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    rows.push(...(await fetchChunk(chunk)))
  }
  return rows
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
    (filters.status && filters.status !== "all") ||
      (filters.type && filters.type !== "all")
  )
}

function mergeAdditionalFees(fees: AdditionalFeeItem[]): AdditionalFeeItem[] {
  const map = new Map<string, number>()
  for (const fee of fees) {
    const key = fee.label.trim() || "Additional fee"
    map.set(key, (map.get(key) || 0) + Number(fee.amount || 0))
  }
  return [...map.entries()].map(([label, amount]) => ({ label, amount }))
}

function aggregateFamilyRegistrationRows(
  rows: RegistrationRow[],
  departmentNameById: Map<string, string>,
  programKindById: Map<string, ProgramKind>
) {
  const groups = new Map<string, RegistrationRow[]>()

  for (const row of rows) {
    const contactKey =
      row.contact_profile_id ||
      (row.contact_email ? `email:${row.contact_email.toLowerCase()}` : null) ||
      (row.contact_phone ? `phone:${row.contact_phone}` : null) ||
      `name:${row.contact_name}` ||
      row.id
    const key = `${row.type}|${row.program_id || "none"}|${contactKey}`
    const list = groups.get(key) || []
    list.push(row)
    groups.set(key, list)
  }

  return [...groups.entries()]
    .map(([groupKey, members]) => {
      const sorted = [...members].sort((a, b) => {
        const aDate = a.registered_date
          ? new Date(a.registered_date).getTime()
          : 0
        const bDate = b.registered_date
          ? new Date(b.registered_date).getTime()
          : 0
        return aDate - bDate
      })
      const primary = sorted[0]
      const participantNames = [
        ...new Set(
          sorted
            .map((row) => row.participant_name?.trim())
            .filter((name): name is string => Boolean(name))
        ),
      ]
      const offeringPairs = sorted
        .filter((row) => row.offering_id)
        .map((row) => ({
          id: row.offering_id as string,
          name: row.offering_name,
        }))
      const offeringIds: string[] = []
      const offeringNames: string[] = []
      for (const pair of offeringPairs) {
        if (offeringIds.includes(pair.id)) continue
        offeringIds.push(pair.id)
        offeringNames.push(pair.name)
      }

      const hasActiveMember = sorted.some(
        (row) =>
          row.type === "waitlist" ||
          !isTerminalEnrollmentStatus(row.status)
      )
      const offeringActivity = sorted.some(
        (row) => row.offering_activity === "active"
      )
        ? ("active" as const)
        : ("closed" as const)

      const totalAmount = sorted.reduce(
        (sum, row) => sum + Number(row.total_amount || 0),
        0
      )
      const amountPaid = sorted.reduce(
        (sum, row) => sum + Number(row.amount_paid || 0),
        0
      )
      const additionalFees = mergeAdditionalFees(
        sorted.flatMap((row) => row.additional_fees)
      )
      const registrationFeeTotal = sorted.reduce(
        (sum, row) => sum + Number(row.registration_fee || 0),
        0
      )

      const primaryActive =
        sorted.find(
          (row) =>
            row.type === "enrollment" &&
            !isTerminalEnrollmentStatus(row.status)
        ) || primary

      const departmentId = primary.department_id
      const departmentName = departmentId
        ? departmentNameById.get(departmentId) || "Unknown department"
        : "No department"

      return {
        id: groupKey,
        type: primary.type,
        contactName: primary.contact_name,
        contactProfileId: primary.contact_profile_id,
        contactEmail: primary.contact_email,
        contactPhone: primary.contact_phone,
        participantCount: participantNames.length,
        participantNames,
        departmentId,
        departmentName,
        programId: primary.program_id,
        programName: primary.program_name,
        programKind: programKindById.get(primary.program_id || "") || "academic",
        offeringIds,
        offeringNames,
        offeringActivity,
        registeredDateLabel: formatDate(primary.registered_date),
        sortDate: primary.registered_date,
        registrationFeeLabel:
          primary.type === "waitlist"
            ? "—"
            : formatCurrency(registrationFeeTotal),
        registrationPaidLabel:
          primary.type === "waitlist" ? "—" : formatCurrency(amountPaid),
        additionalFees,
        registrationStatus: hasActiveMember
          ? ("active" as const)
          : ("cancelled" as const),
        primaryRegistrationId: primaryActive.id,
        enrollmentStatus: primaryActive.status,
        totalAmount,
        amountPaid,
        notes: primaryActive.notes,
      }
    })
    .sort((a, b) => {
      const aDate = a.sortDate ? new Date(a.sortDate).getTime() : 0
      const bDate = b.sortDate ? new Date(b.sortDate).getTime() : 0
      return bDate - aDate
    })
    .map(({ sortDate: _sortDate, ...row }) => row)
}

function matchesFilters(row: RegistrationRow, filters: PageSearchParams) {
  const statusFilter = (filters.status || "all").toLowerCase()
  const typeFilter = filters.type || "all"

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

  return matchesStatus && matchesType
}

export default async function ProgramsRegistrationsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const resolvedSearchParams = await searchParams

  const filters: PageSearchParams = {
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
  const programKindById = new Map(
    programs.map((program) => [
      program.id,
      normalizeProgramKind(program.program_kind),
    ])
  )
  const programDepartmentById = new Map(
    programs.map((program) => [
      program.id,
      (program.department_id as string | null) || null,
    ])
  )
  const departmentNameById = new Map(
    departments.map((department) => [department.id, department.name])
  )

  let enrollments: EnrollmentRow[] = []
  let waitlist: WaitlistRow[] = []
  let loadError: string | null = null
  const offeringNameById = new Map<string, string>()
  const activeOfferingIds = new Set<string>()
  const feesByEnrollmentId = new Map<
    string,
    { registrationFee: number | null; additionalFees: AdditionalFeeItem[] }
  >()
  const cancelledByEnrollmentId = new Map<string, string>()

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
          child_person_id,
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
          created_at,
          cancelled_at,
          withdrawn_at
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
          .select(
            "id, name, program_id, status, start_date, end_date, enrollment_open_date, enrollment_close_date, inherit_dates"
          )
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

    const programById = new Map(programs.map((program) => [program.id, program]))

    for (const offering of offeringsResult.data || []) {
      const id = offering.id as string
      const name = (offering.name as string) || PROGRAM_LABEL
      offeringNameById.set(id, name)

      const programId = offering.program_id as string | null
      const program = programId ? programById.get(programId) : null

      if (
        isOfferingCurrentlyActive(
          {
            status: (offering.status as string) || "draft",
            start_date: (offering.start_date as string | null) ?? null,
            end_date: (offering.end_date as string | null) ?? null,
            enrollment_open_date:
              (offering.enrollment_open_date as string | null) ?? null,
            enrollment_close_date:
              (offering.enrollment_close_date as string | null) ?? null,
            inherit_dates: Boolean(offering.inherit_dates),
          },
          program ?? null
        )
      ) {
        activeOfferingIds.add(id)
      }
    }

    const enrollmentIds = enrollments.map((row) => row.id)
    if (enrollmentIds.length > 0) {
      const charges = await fetchByIdChunks(enrollmentIds, async (chunk) => {
        const { data, error } = await supabase
          .from("program_charges")
          .select(
            "id, enrollment_id, charge_type, total, subtotal, discount_total, metadata, quote_snapshot"
          )
          .eq("organization_id", organizationId)
          .in("enrollment_id", chunk)
        if (error) {
          console.error("registrations charges:", error.message)
          return []
        }
        return (data || []) as RegistrationChargeInput[]
      })

      const chargeIds = charges.map((charge) => charge.id)
      const lines = await fetchByIdChunks(chargeIds, async (chunk) => {
        const { data, error } = await supabase
          .from("program_charge_lines")
          .select("charge_id, line_type, label, amount, metadata")
          .eq("organization_id", organizationId)
          .in("charge_id", chunk)
        if (error) {
          console.error("registrations charge lines:", error.message)
          return []
        }
        return (data || []) as Array<
          RegistrationFeeLineInput & { charge_id: string }
        >
      })

      const linesByChargeId = new Map<string, RegistrationFeeLineInput[]>()
      for (const line of lines) {
        const list = linesByChargeId.get(line.charge_id) || []
        list.push(line)
        linesByChargeId.set(line.charge_id, list)
      }

      const chargesByEnrollmentId = new Map<string, RegistrationChargeInput[]>()
      for (const charge of charges) {
        const enrollmentId = charge.enrollment_id
        if (!enrollmentId) continue
        const list = chargesByEnrollmentId.get(enrollmentId) || []
        list.push(charge)
        chargesByEnrollmentId.set(enrollmentId, list)
      }

      for (const enrollmentId of enrollmentIds) {
        feesByEnrollmentId.set(
          enrollmentId,
          buildEnrollmentFeeBreakdown(
            chargesByEnrollmentId.get(enrollmentId) || [],
            linesByChargeId
          )
        )
      }

      const cancelledEnrollmentIds = enrollments
        .filter((row) => {
          const status = (row.status || "").toLowerCase()
          return (
            status === "cancelled" ||
            status === "canceled" ||
            status === "withdrawn" ||
            Boolean(row.cancelled_at) ||
            Boolean(row.withdrawn_at)
          )
        })
        .map((row) => row.id)

      if (cancelledEnrollmentIds.length > 0) {
        const history = await fetchByIdChunks(
          cancelledEnrollmentIds,
          async (chunk) => {
            const { data, error } = await supabase
              .from("program_enrollment_status_history")
              .select(
                "enrollment_id, to_status, actor_type, actor_user_id, created_at"
              )
              .eq("organization_id", organizationId)
              .in("enrollment_id", chunk)
              .in("to_status", ["cancelled", "canceled", "withdrawn"])
              .order("created_at", { ascending: false })
            if (error) {
              console.error("registrations cancel history:", error.message)
              return []
            }
            return data || []
          }
        )

        const latestByEnrollment = new Map<
          string,
          {
            actor_type: string | null
            actor_user_id: string | null
          }
        >()
        for (const row of history) {
          const enrollmentId = row.enrollment_id as string
          if (latestByEnrollment.has(enrollmentId)) continue
          latestByEnrollment.set(enrollmentId, {
            actor_type: (row.actor_type as string | null) || null,
            actor_user_id: (row.actor_user_id as string | null) || null,
          })
        }

        const actorIds = [
          ...new Set(
            [...latestByEnrollment.values()]
              .map((row) => row.actor_user_id)
              .filter((id): id is string => Boolean(id))
          ),
        ]
        const profileNameById = new Map<string, string>()
        if (actorIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", actorIds)
          for (const profile of profiles || []) {
            const name =
              (profile.full_name as string | null)?.trim() ||
              (profile.email as string | null)?.trim() ||
              null
            if (name) profileNameById.set(profile.id as string, name)
          }
        }

        for (const [enrollmentId, actor] of latestByEnrollment) {
          if (actor.actor_user_id && profileNameById.has(actor.actor_user_id)) {
            cancelledByEnrollmentId.set(
              enrollmentId,
              profileNameById.get(actor.actor_user_id)!
            )
          } else if (actor.actor_type === "system") {
            cancelledByEnrollmentId.set(enrollmentId, "System")
          } else if (actor.actor_type) {
            cancelledByEnrollmentId.set(
              enrollmentId,
              actor.actor_type.replace(/_/g, " ")
            )
          }
        }
      }
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

      const fees = feesByEnrollmentId.get(row.id)
      const registrationFee =
        fees?.registrationFee ??
        (row.total_amount != null ? Number(row.total_amount) : null)
      const statusLower = (row.status || "").toLowerCase()
      const isCancelled =
        statusLower === "cancelled" ||
        statusLower === "canceled" ||
        statusLower === "withdrawn" ||
        Boolean(row.cancelled_at) ||
        Boolean(row.withdrawn_at)
      const cancellationDate = isCancelled
        ? row.cancelled_at || row.withdrawn_at || null
        : null

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
        offering_activity:
          row.offering_id && activeOfferingIds.has(row.offering_id)
            ? ("active" as const)
            : ("closed" as const),
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
        registration_fee: registrationFee,
        additional_fees: fees?.additionalFees || [],
        cancellation_date: cancellationDate,
        cancelled_by: isCancelled
          ? cancelledByEnrollmentId.get(row.id) || null
          : null,
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
      offering_activity: "closed" as const,
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
      registration_fee: null,
      additional_fees: [] as AdditionalFeeItem[],
      cancellation_date: null,
      cancelled_by: null,
    })),
  ].sort((a, b) => {
    const aDate = a.registered_date ? new Date(a.registered_date).getTime() : 0
    const bDate = b.registered_date ? new Date(b.registered_date).getTime() : 0
    return bDate - aDate
  })

  const filteredRows = registrationRows.filter((row) =>
    matchesFilters(row, filters)
  )

  const familyRows = aggregateFamilyRegistrationRows(
    filteredRows,
    departmentNameById,
    programKindById
  )

  const filtersActive = hasActiveFilters(filters)

  return (
    <>
      <Header title="Reports" />

      <Suspense fallback={null}>
        <ProgramsReportsNav />
      </Suspense>

      <div className="p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Registrations
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled>
              <Download className="mr-2 h-4 w-4" />
              Export Coming Soon
            </Button>
          </div>
        </div>

        {filtersActive ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <p>
              Showing {filteredRows.length}{" "}
              {filteredRows.length === 1 ? "result" : "results"}
            </p>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/programs/registrations">Clear filters</Link>
            </Button>
          </div>
        ) : null}

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
              <Suspense fallback={null}>
                <ProgramsRegistrationsTable
                  emptyMessage="No registrations found"
                  emptyDescription={
                    filtersActive
                      ? "Try clearing filters, or registrations will appear here after enrollment."
                      : "Registrations for open years will appear here after enrollment."
                  }
                  rows={familyRows}
                />
              </Suspense>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
