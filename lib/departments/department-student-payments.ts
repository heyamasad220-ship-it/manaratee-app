"use server"

import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { isBillingSchemaMissingError } from "@/lib/programs/program-billing-schema"
import type { ChargeScheduleStatus } from "@/lib/programs/program-billing-types"
import { periodKeyClampedToProgramYear } from "@/lib/programs/program-year-attribution"
import { contactLabel, loadContactsByIds } from "@/lib/programs/registration-display-helpers"
import { createClient } from "@/lib/supabase/server"

const ACTIVE_ENROLLMENT_STATUSES = [
  "pending_payment",
  "pending",
  "enrolled",
  "active",
  "completed",
] as const

/** Month columns for the department student-payments matrix (not fixed Sept–May). */
export type DepartmentPaymentMonthColumn = {
  periodKey: string
  label: string
}

export type DepartmentPaymentMonthCell = {
  periodKey: string
  amount: number | null
  status: ChargeScheduleStatus | null
  scheduleId: string | null
}

export type DepartmentStudentPaymentRow = {
  enrollmentId: string
  studentName: string
  studentContactId: string | null
  teacherName: string | null
  courseName: string
  programId: string
  offeringId: string | null
  courseFee: number
  /** Childcare / extended-care add-on fees on this enrollment (shown on Students tab). */
  childcareFee: number
  /** Childcare amounts by billing month (rolled into Budget student payments, no separate label). */
  childcareMonths: Record<string, number>
  discount: number
  received: number
  remaining: number
  paidInFull: boolean
  /** Tuition installments by month (Students tab month columns). */
  months: Record<string, DepartmentPaymentMonthCell>
}

export type DepartmentStudentPaymentsMatrix = {
  months: DepartmentPaymentMonthColumn[]
  rows: DepartmentStudentPaymentRow[]
  migrationRequired: boolean
}

function shortMonthLabel(periodKey: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(periodKey)
  if (!match) return periodKey
  const year = Number(match[1])
  const month = Number(match[2])
  if (!year || month < 1 || month > 12) return periodKey
  const date = new Date(Date.UTC(year, month - 1, 1))
  return date.toLocaleString("en-US", { month: "short", timeZone: "UTC" })
}

function periodKeyFromDate(value: string | null | undefined) {
  if (!value) return null
  const match = /^(\d{4}-\d{2})/.exec(value)
  return match?.[1] ?? null
}

function isTuitionLikeCategory(category: string | null | undefined) {
  const value = (category || "").toLowerCase()
  if (!value) return true
  if (value === "addon" || value === "materials" || value === "custom") return false
  return true
}

/** Childcare fee add-ons on the charge schedule (not tuition installments). */
function isChildcareAddon(
  category: string | null | undefined,
  label: string | null | undefined
) {
  const text = (label || "").toLowerCase()
  if (
    /child\s*care|babysit|extended\s*care|before\s*care|after\s*care|day\s*care/.test(
      text
    )
  ) {
    return true
  }
  const cat = (category || "").toLowerCase()
  // Fee-plan extended care often lands as addon with a care-related name already matched above.
  return cat === "addon" && /care|sitter/.test(text)
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

/**
 * Sheet-style student payment matrix for a department: one row per enrollment,
 * dynamic month columns from billing periods / charge schedules.
 */
export async function fetchDepartmentStudentPaymentsMatrix(
  departmentId: string
): Promise<DepartmentStudentPaymentsMatrix> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { months: [], rows: [], migrationRequired: false }
  }

  const supabase = await createClient()

  const { data: programs, error: programsError } = await supabase
    .from("programs")
    .select("id, name, department_id, start_date, end_date")
    .eq("organization_id", organizationId)
    .eq("department_id", departmentId)
    .in("status", ["draft", "active", "paused"])

  if (programsError) {
    throw new Error(programsError.message || "Could not load department programs.")
  }

  const programIds = (programs || []).map((row) => row.id as string)
  const programNameById = new Map(
    (programs || []).map((row) => [row.id as string, (row.name as string) || "Program"])
  )
  const programDatesById = new Map(
    (programs || []).map((row) => [
      row.id as string,
      {
        start: (row.start_date as string | null) || null,
        end: (row.end_date as string | null) || null,
      },
    ])
  )

  let enrollmentsQuery = supabase
    .from("program_enrollments")
    .select(
      `
      id,
      program_id,
      offering_id,
      charge_id,
      child_name,
      participant_contact_id,
      status,
      total_amount,
      amount_paid,
      department_id,
      program_charges:charge_id (
        id,
        subtotal,
        discount_total,
        total,
        amount_paid,
        charge_status
      ),
      offering:offering_id (
        id,
        name
      )
    `
    )
    .eq("organization_id", organizationId)
    .in("status", [...ACTIVE_ENROLLMENT_STATUSES])
    .order("child_name", { ascending: true })

  if (programIds.length > 0) {
    enrollmentsQuery = enrollmentsQuery.or(
      `department_id.eq.${departmentId},program_id.in.(${programIds.join(",")})`
    )
  } else {
    enrollmentsQuery = enrollmentsQuery.eq("department_id", departmentId)
  }

  const { data: enrollmentRows, error: enrollmentsError } = await enrollmentsQuery

  if (enrollmentsError) {
    throw new Error(enrollmentsError.message || "Could not load enrollments.")
  }

  const enrollments = (enrollmentRows || []).filter((row) => {
    const enrollmentDept = row.department_id as string | null
    const programId = row.program_id as string
    return enrollmentDept === departmentId || programIds.includes(programId)
  })

  if (enrollments.length === 0) {
    return { months: [], rows: [], migrationRequired: false }
  }

  const offeringIds = [
    ...new Set(
      enrollments
        .map((row) => row.offering_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ]

  const chargeIds = enrollments
    .map((row) => row.charge_id as string | null)
    .filter((id): id is string => Boolean(id))

  const periodIdToKey = new Map<string, string>()
  const periodKeySet = new Set<string>()
  let migrationRequired = false

  if (offeringIds.length > 0) {
    const { data: periods, error: periodsError } = await supabase
      .from("program_offering_billing_periods")
      .select("id, offering_id, period_key, period_label, sequence_number, period_status")
      .eq("organization_id", organizationId)
      .in("offering_id", offeringIds)
      .order("period_key", { ascending: true })

    if (periodsError) {
      if (isBillingSchemaMissingError(periodsError.message)) {
        migrationRequired = true
      } else {
        throw new Error(periodsError.message)
      }
    } else {
      for (const period of periods || []) {
        if ((period.period_status as string) === "skipped") continue
        const key = period.period_key as string
        periodIdToKey.set(period.id as string, key)
        periodKeySet.add(key)
      }
    }
  }

  type ScheduleRow = {
    id: string
    charge_id: string
    billing_period_id: string | null
    charge_category: string | null
    label: string | null
    amount: number
    status: ChargeScheduleStatus
    due_date: string | null
    kind: "tuition" | "childcare"
  }

  const scheduleByChargeId = new Map<string, ScheduleRow[]>()

  if (chargeIds.length > 0 && !migrationRequired) {
    const { data: scheduleRows, error: scheduleError } = await supabase
      .from("program_charge_schedule")
      .select(
        "id, charge_id, billing_period_id, charge_category, label, amount, status, due_date, sequence_number"
      )
      .eq("organization_id", organizationId)
      .in("charge_id", chargeIds)
      .order("sequence_number", { ascending: true })

    if (scheduleError) {
      if (isBillingSchemaMissingError(scheduleError.message)) {
        migrationRequired = true
      } else {
        throw new Error(scheduleError.message)
      }
    } else {
      for (const raw of scheduleRows || []) {
        const category = raw.charge_category as string | null
        const label = (raw.label as string | null) ?? null
        const childcare = isChildcareAddon(category, label)
        const tuition = isTuitionLikeCategory(category)
        if (!tuition && !childcare) continue

        const row: ScheduleRow = {
          id: raw.id as string,
          charge_id: raw.charge_id as string,
          billing_period_id: (raw.billing_period_id as string | null) ?? null,
          charge_category: category,
          label,
          amount: Number(raw.amount || 0),
          status: raw.status as ChargeScheduleStatus,
          due_date: (raw.due_date as string | null) ?? null,
          kind: childcare ? "childcare" : "tuition",
        }

        const existing = scheduleByChargeId.get(row.charge_id) || []
        existing.push(row)
        scheduleByChargeId.set(row.charge_id, existing)

        if (row.billing_period_id) {
          const key = periodIdToKey.get(row.billing_period_id)
          if (key) periodKeySet.add(key)
        } else {
          const fromDue = periodKeyFromDate(row.due_date)
          if (fromDue) periodKeySet.add(fromDue)
        }
      }
    }
  }

  const teacherByOfferingId = new Map<string, string>()

  if (offeringIds.length > 0) {
    const { data: assignments, error: assignmentError } = await supabase
      .from("program_staff_assignments")
      .select(
        `
        offering_id,
        assignment_role,
        is_active,
        contact:contact_id ( full_name )
      `
      )
      .eq("organization_id", organizationId)
      .in("offering_id", offeringIds)
      .eq("is_active", true)
      .order("created_at", { ascending: true })

    if (!assignmentError) {
      for (const row of assignments || []) {
        const offeringId = row.offering_id as string
        if (teacherByOfferingId.has(offeringId)) continue
        const role = (row.assignment_role as string) || ""
        if (role && role !== "primary_instructor" && role !== "instructor") {
          continue
        }
        const contact = row.contact as { full_name?: string | null } | null
        const name = contact?.full_name?.trim()
        if (name) teacherByOfferingId.set(offeringId, name)
      }

      // Fallback: any active assignment if no primary/instructor role matched.
      for (const row of assignments || []) {
        const offeringId = row.offering_id as string
        if (teacherByOfferingId.has(offeringId)) continue
        const contact = row.contact as { full_name?: string | null } | null
        const name = contact?.full_name?.trim()
        if (name) teacherByOfferingId.set(offeringId, name)
      }
    }
  }

  const contactsById = await loadContactsByIds(
    organizationId,
    enrollments
      .map((row) => row.participant_contact_id as string | null)
      .filter((id): id is string => Boolean(id))
  )

  const rows: DepartmentStudentPaymentRow[] = enrollments.map((row) => {
    const charge = row.program_charges as {
      id: string
      subtotal: number | null
      discount_total: number | null
      total: number | null
      amount_paid: number | null
      charge_status: string | null
    } | null

    const offering = row.offering as { id: string; name: string | null } | null
    const programId = row.program_id as string
    const offeringId = (row.offering_id as string | null) ?? null
    const chargeId = (row.charge_id as string | null) ?? null
    const scheduleItems = chargeId ? scheduleByChargeId.get(chargeId) || [] : []

    const courseFee = roundMoney(
      Number(
        charge?.subtotal ??
          (charge?.total != null
            ? Number(charge.total) + Number(charge.discount_total || 0)
            : row.total_amount || 0)
      )
    )
    const discount = roundMoney(Number(charge?.discount_total || 0))
    const netTotal = roundMoney(Number(charge?.total ?? Math.max(courseFee - discount, 0)))
    const received = roundMoney(
      Number(charge?.amount_paid ?? row.amount_paid ?? 0)
    )
    const remaining = roundMoney(Math.max(netTotal - received, 0))
    const paidInFull =
      (charge?.charge_status || "").toLowerCase() === "paid" || remaining <= 0.009

    const monthCells: Record<string, DepartmentPaymentMonthCell> = {}
    const childcareMonths: Record<string, number> = {}
    let childcareFee = 0

    for (const item of scheduleItems) {
      const programDates = programDatesById.get(programId)
      let periodKey: string | null = null
      if (item.billing_period_id) {
        periodKey = periodIdToKey.get(item.billing_period_id) ?? null
      }
      if (!periodKey) {
        // Late cash still attributes inside the year/season window.
        periodKey = periodKeyClampedToProgramYear(
          item.due_date,
          programDates?.start,
          programDates?.end
        )
      }

      if (periodKey) periodKeySet.add(periodKey)

      if (item.kind === "childcare") {
        childcareFee = roundMoney(childcareFee + item.amount)
        if (periodKey) {
          childcareMonths[periodKey] = roundMoney(
            Number(childcareMonths[periodKey] || 0) + item.amount
          )
        }
        continue
      }

      if (!periodKey) continue

      const existing = monthCells[periodKey]
      if (existing) {
        monthCells[periodKey] = {
          ...existing,
          amount: roundMoney(Number(existing.amount || 0) + item.amount),
          status: item.status === "paid" || existing.status === "paid" ? "paid" : item.status,
        }
      } else {
        monthCells[periodKey] = {
          periodKey,
          amount: roundMoney(item.amount),
          status: item.status,
          scheduleId: item.id,
        }
      }
    }

    // One-time childcare with no period: attribute to first tuition month or leave in fee only.
    if (childcareFee > 0 && Object.keys(childcareMonths).length === 0) {
      const fallbackKey =
        Object.keys(monthCells).sort()[0] || [...periodKeySet].sort()[0] || null
      if (fallbackKey) {
        childcareMonths[fallbackKey] = childcareFee
      }
    }

    const courseName =
      offering?.name?.trim() ||
      programNameById.get(programId) ||
      "Course"

    return {
      enrollmentId: row.id as string,
      studentName: contactLabel(
        row.participant_contact_id
          ? contactsById.get(row.participant_contact_id as string)
          : undefined,
        row.child_name as string
      ),
      studentContactId: (row.participant_contact_id as string | null) ?? null,
      teacherName: offeringId ? teacherByOfferingId.get(offeringId) || null : null,
      courseName,
      programId,
      offeringId,
      courseFee,
      childcareFee,
      childcareMonths,
      discount,
      received,
      remaining,
      paidInFull,
      months: monthCells,
    }
  })

  rows.sort((a, b) => a.studentName.localeCompare(b.studentName))

  const monthKeys = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row.months)) monthKeys.add(key)
    for (const key of Object.keys(row.childcareMonths)) monthKeys.add(key)
  }
  // Keep billing-period months even if empty (column headers for the year).
  for (const key of periodKeySet) monthKeys.add(key)

  const months: DepartmentPaymentMonthColumn[] = [...monthKeys]
    .sort()
    .map((periodKey) => ({
      periodKey,
      label: shortMonthLabel(periodKey),
    }))

  return { months, rows, migrationRequired }
}

export async function fetchDepartmentStudentPaymentsAction(departmentId: string) {
  try {
    const matrix = await fetchDepartmentStudentPaymentsMatrix(departmentId)
    return { success: true as const, matrix }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Could not load students.",
    }
  }
}
