"use server"

import { canViewDepartment } from "@/lib/departments/department-access"
import { roundMoney } from "@/lib/departments/department-period-helpers"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  getOfferingRegistrationState,
  type OfferingRegistrationState,
} from "@/lib/programs/program-offering-display"
import { createClient } from "@/lib/supabase/server"

import {
  ROSTER_ENROLLMENT_STATUSES,
} from "@/lib/programs/enrollment-process"

const TERMINAL_ENROLLMENT_STATUSES = [
  "cancelled",
  "withdrawn",
  "transferred",
  "expired",
] as const

export type ProgramOverviewCouponRow = {
  code: string
  kind: "financial_assistance" | "discount"
  enrollmentCount: number
  amount: number
}

export type ProgramOverviewOutstandingRow = {
  enrollmentId: string
  studentName: string
  offeringName: string
  paid: number
  balance: number
}

export type ProgramOverviewAttentionHref =
  | "applications"
  | "enrollments"
  | "offerings"
  | "finance"

export type ProgramOverviewAttentionItem = {
  id: string
  title: string
  detail: string
  tone: "amber" | "rose" | "slate"
  hrefSection?: ProgramOverviewAttentionHref
}

export type ProgramOverviewOfferingRow = {
  id: string
  name: string
  instructorName: string | null
  enrolled: number
  capacity: number | null
  registrationState: OfferingRegistrationState
}

export type ProgramOverviewActivityKind =
  | "registration"
  | "payment"
  | "application"
  | "approval"

export type ProgramOverviewActivityItem = {
  id: string
  at: string
  kind: ProgramOverviewActivityKind
  title: string
}

export type ProgramOverviewMetrics = {
  programId: string
  programName: string
  applicationsTotal: number
  applicationsNeedsReview: number
  applicationsApprovedPending: number
  applicationsApprovedTotal: number
  applicationsNotApproved: number
  enrollmentsActive: number
  enrollmentsPaid: number
  enrollmentsFree: number
  enrollmentsCancelled: number
  uniqueStudentsActive: number
  offeringsTotal: number
  offeringsPaid: number
  offeringsFree: number
  collectedGross: number
  refunded: number
  collectedNet: number
  outstanding: number
  outstandingEnrollmentCount: number
  programCharges: number
  adjustedTuition: number
  financialAssistance: number
  financialAssistanceCount: number
  discounts: number
  discountCount: number
  fullPayDiscounts: number
  coupons: ProgramOverviewCouponRow[]
  outstandingRows: ProgramOverviewOutstandingRow[]
  offeringRows: ProgramOverviewOfferingRow[]
  activity: ProgramOverviewActivityItem[]
  attention: ProgramOverviewAttentionItem[]
}

function emptyMetrics(programId: string, programName: string): ProgramOverviewMetrics {
  return {
    programId,
    programName,
    applicationsTotal: 0,
    applicationsNeedsReview: 0,
    applicationsApprovedPending: 0,
    applicationsApprovedTotal: 0,
    applicationsNotApproved: 0,
    enrollmentsActive: 0,
    enrollmentsPaid: 0,
    enrollmentsFree: 0,
    enrollmentsCancelled: 0,
    uniqueStudentsActive: 0,
    offeringsTotal: 0,
    offeringsPaid: 0,
    offeringsFree: 0,
    collectedGross: 0,
    refunded: 0,
    collectedNet: 0,
    outstanding: 0,
    outstandingEnrollmentCount: 0,
    programCharges: 0,
    adjustedTuition: 0,
    financialAssistance: 0,
    financialAssistanceCount: 0,
    discounts: 0,
    discountCount: 0,
    fullPayDiscounts: 0,
    coupons: [],
    outstandingRows: [],
    offeringRows: [],
    activity: [],
    attention: [],
  }
}

function isFaCode(code: string) {
  return /^FA\b|^FA[-_]/i.test(code)
}

function isDiscountCode(code: string) {
  if (!code || isFaCode(code)) return false
  return /^(STAFF|MEMBER|CREDIT)/i.test(code) || code.length > 0
}

function contactFullName(contact: unknown): string {
  const row = Array.isArray(contact) ? contact[0] : contact
  if (!row || typeof row !== "object") return ""
  return String((row as { full_name?: string | null }).full_name || "").trim()
}

function isVoidedChargeStatus(status: string) {
  const value = status.toLowerCase()
  return value === "voided" || value === "void"
}

async function fetchAll<T>(
  query: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const pageSize = 1000
  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await query(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data || []))
    if (!data || data.length < pageSize) break
  }
  return rows
}

export async function fetchProgramOverviewMetricsAction(
  departmentId: string,
  programId: string
): Promise<
  | { success: true; data: ProgramOverviewMetrics }
  | { success: false; error: string }
> {
  try {
    if (!(await canViewDepartment(departmentId))) {
      return { success: false, error: "You do not have permission to view this program." }
    }
    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false, error: "No organization selected." }
    }

    const supabase = await createClient()
    const { data: program, error: programError } = await supabase
      .from("programs")
      .select("id, name, department_id, enrollment_open_date, enrollment_close_date")
      .eq("id", programId)
      .eq("organization_id", organizationId)
      .maybeSingle()

    if (programError || !program || program.department_id !== departmentId) {
      return { success: false, error: "Program not found." }
    }

    const programName = (program.name as string) || "Program"

    const [applications, enrollments, offerings, feePlans, assignments, scheduleItems] =
      await Promise.all([
      fetchAll((from, to) =>
        supabase
          .from("program_applications")
          .select("id, status, enrollment_id, participant_name, created_at, evaluated_at")
          .eq("organization_id", organizationId)
          .eq("program_id", programId)
          .range(from, to)
      ),
      fetchAll((from, to) =>
        supabase
          .from("program_enrollments")
          .select(
            "id, status, amount_paid, total_amount, child_name, offering_id, participant_contact_id, created_at"
          )
          .eq("organization_id", organizationId)
          .eq("program_id", programId)
          .range(from, to)
      ),
      fetchAll((from, to) =>
        supabase
          .from("program_offerings")
          .select(
            "id, name, capacity, status, enrollment_open_date, enrollment_close_date"
          )
          .eq("organization_id", organizationId)
          .eq("program_id", programId)
          .range(from, to)
      ),
      fetchAll((from, to) =>
        supabase
          .from("program_offering_fee_plans")
          .select("offering_id, plan_type, is_default, is_active, metadata")
          .eq("organization_id", organizationId)
          .eq("program_id", programId)
          .range(from, to)
      ),
      fetchAll((from, to) =>
        supabase
          .from("program_staff_assignments")
          .select(
            "offering_id, assignment_role, is_active, contact:contact_id ( full_name )"
          )
          .eq("organization_id", organizationId)
          .eq("program_id", programId)
          .eq("is_active", true)
          .in("assignment_role", ["primary_instructor", "instructor"])
          .range(from, to)
      ),
      fetchAll((from, to) =>
        supabase
          .from("program_schedule_items")
          .select("offering_id, instructor_name")
          .eq("organization_id", organizationId)
          .eq("program_id", programId)
          .range(from, to)
      ),
    ])

    const charges = await fetchAll((from, to) =>
      supabase
        .from("program_charges")
        .select(
          "id, enrollment_id, total, amount_paid, discount_total, charge_status, metadata"
        )
        .eq("organization_id", organizationId)
        .eq("program_id", programId)
        .range(from, to)
    )

    const chargeIds = charges.map((row) => row.id as string)
    const schedule: Array<{
      charge_id: string
      amount: number
      status: string
      paid_at: string | null
    }> = []
    const lines: Array<{
      charge_id: string
      line_type: string | null
      amount: number
      metadata: Record<string, unknown> | null
    }> = []

    for (let i = 0; i < chargeIds.length; i += 150) {
      const chunk = chargeIds.slice(i, i + 150)
      const [{ data: scheduleRows, error: scheduleError }, { data: lineRows, error: lineError }] =
        await Promise.all([
          supabase
            .from("program_charge_schedule")
            .select("charge_id, amount, status, paid_at")
            .eq("organization_id", organizationId)
            .in("charge_id", chunk),
          supabase
            .from("program_charge_lines")
            .select("charge_id, line_type, amount, metadata")
            .eq("organization_id", organizationId)
            .in("charge_id", chunk),
        ])
      if (scheduleError) throw new Error(scheduleError.message)
      if (lineError) throw new Error(lineError.message)
      for (const row of scheduleRows || []) {
        schedule.push({
          charge_id: row.charge_id as string,
          amount: Number(row.amount || 0),
          status: String(row.status || ""),
          paid_at: (row.paid_at as string | null) || null,
        })
      }
      for (const row of lineRows || []) {
        lines.push({
          charge_id: row.charge_id as string,
          line_type: (row.line_type as string | null) || null,
          amount: Number(row.amount || 0),
          metadata: (row.metadata as Record<string, unknown> | null) || null,
        })
      }
    }

    const offeringNameById = new Map(
      offerings.map((row) => [row.id as string, (row.name as string) || "Offering"])
    )
    const instructorByOffering = new Map<string, string>()
    for (const row of scheduleItems) {
      const offeringId = row.offering_id as string | null
      const name = String(row.instructor_name || "").trim()
      if (!offeringId || !name || instructorByOffering.has(offeringId)) continue
      instructorByOffering.set(offeringId, name)
    }
    for (const row of assignments) {
      const offeringId = row.offering_id as string | null
      const name = contactFullName(row.contact)
      if (!offeringId || !name) continue
      if (!instructorByOffering.has(offeringId)) {
        instructorByOffering.set(offeringId, name)
      }
    }
    for (const row of assignments) {
      if (String(row.assignment_role || "") !== "primary_instructor") continue
      const offeringId = row.offering_id as string | null
      const name = contactFullName(row.contact)
      if (offeringId && name) instructorByOffering.set(offeringId, name)
    }
    const programEnrollmentFallback = {
      enrollment_open_date: (program.enrollment_open_date as string | null) || null,
      enrollment_close_date: (program.enrollment_close_date as string | null) || null,
    }
    const defaultPlanByOffering = new Map<string, { plan_type: string; tuition: number }>()
    for (const row of feePlans) {
      if (row.is_active === false) continue
      const offeringId = row.offering_id as string
      const planType = String(row.plan_type || "").toLowerCase()
      const tuition = Number(
        ((row.metadata as Record<string, unknown> | null) || {}).total_tuition ?? NaN
      )
      const current = defaultPlanByOffering.get(offeringId)
      if (!current || row.is_default === true) {
        defaultPlanByOffering.set(offeringId, { plan_type: planType, tuition })
      }
    }
    const freeOfferingIds = new Set(
      [...defaultPlanByOffering.entries()]
        .filter(([, plan]) => plan.plan_type === "free" || plan.tuition === 0)
        .map(([offeringId]) => offeringId)
    )

    let applicationsNeedsReview = 0
    let applicationsApprovedPending = 0
    let applicationsApprovedTotal = 0
    let applicationsNotApproved = 0
    for (const row of applications) {
      const status = String(row.status || "")
      if (status === "submitted") applicationsNeedsReview += 1
      else if (status === "approved") {
        applicationsApprovedTotal += 1
        if (!row.enrollment_id) applicationsApprovedPending += 1
      } else if (status === "not_approved") applicationsNotApproved += 1
    }

    const rosterSet = new Set<string>(ROSTER_ENROLLMENT_STATUSES)
    const terminalSet = new Set<string>(TERMINAL_ENROLLMENT_STATUSES)
    let enrollmentsActive = 0
    let enrollmentsPaid = 0
    let enrollmentsFree = 0
    let enrollmentsCancelled = 0
    const uniqueStudents = new Set<string>()
    const outstandingRows: ProgramOverviewOutstandingRow[] = []
    let outstanding = 0
    const enrolledByOffering = new Map<string, number>()

    for (const row of enrollments) {
      const status = String(row.status || "").toLowerCase()
      const paid = Number(row.amount_paid || 0)
      const total = Number(row.total_amount || 0)
      const offeringId = (row.offering_id as string | null) || ""
      if (rosterSet.has(status)) {
        enrollmentsActive += 1
        if (freeOfferingIds.has(offeringId)) enrollmentsFree += 1
        else enrollmentsPaid += 1
        const person = (row.participant_contact_id as string | null) || (row.id as string)
        uniqueStudents.add(person)
        enrolledByOffering.set(offeringId, (enrolledByOffering.get(offeringId) || 0) + 1)
        const balance = roundMoney(Math.max(total - paid, 0))
        if (balance > 0.009) {
          outstanding = roundMoney(outstanding + balance)
          outstandingRows.push({
            enrollmentId: row.id as string,
            studentName: (row.child_name as string) || "Student",
            offeringName: offeringNameById.get(offeringId) || "Offering",
            paid: roundMoney(paid),
            balance,
          })
        }
      } else if (terminalSet.has(status)) {
        enrollmentsCancelled += 1
      }
    }
    outstandingRows.sort((a, b) => b.balance - a.balance)

    let collectedGross = 0
    let refunded = 0
    for (const row of schedule) {
      const status = row.status.toLowerCase()
      if (status === "paid") collectedGross = roundMoney(collectedGross + row.amount)
      if (status === "refunded") refunded = roundMoney(refunded + row.amount)
    }

    const faEnrollmentIds = new Set<string>()
    const discountEnrollmentIds = new Set<string>()
    const couponMap = new Map<string, ProgramOverviewCouponRow>()
    const couponEnrollmentIds = new Map<string, Set<string>>()
    let financialAssistance = 0
    let discounts = 0
    let fullPayDiscounts = 0
    let programCharges = 0

    const chargeById = new Map(charges.map((row) => [row.id as string, row]))

    function addCoupon(
      code: string,
      kind: ProgramOverviewCouponRow["kind"],
      amount: number,
      enrollmentId: string
    ) {
      const current = couponMap.get(code) || {
        code,
        kind,
        enrollmentCount: 0,
        amount: 0,
      }
      current.amount = roundMoney(current.amount + amount)
      couponMap.set(code, current)
      if (!enrollmentId) return
      const ids = couponEnrollmentIds.get(code) || new Set<string>()
      ids.add(enrollmentId)
      couponEnrollmentIds.set(code, ids)
    }

    for (const line of lines) {
      const charge = chargeById.get(line.charge_id)
      if (isVoidedChargeStatus(String(charge?.charge_status || ""))) continue
      const enrollmentId = (charge?.enrollment_id as string | null) || ""
      const meta = {
        ...((charge?.metadata as Record<string, unknown> | null) || {}),
        ...(line.metadata || {}),
      }
      const couponCode = String(meta.coupon_code || "").trim().toUpperCase()
      const couponType = String(meta.coupon_type || line.line_type || "").toLowerCase()
      const abs = roundMoney(Math.abs(line.amount))
      const type = String(line.line_type || "").toLowerCase()
      if (abs <= 0.009) continue
      if (type === "tuition" || type === "fee" || type === "addon" || type === "transaction_fee") {
        if (line.amount > 0.009) {
          programCharges = roundMoney(programCharges + line.amount)
        }
        continue
      }

      const isFa =
        type === "financial_assistance" ||
        couponType === "financial_assistance" ||
        isFaCode(couponCode)
      const isCodedDiscount =
        type === "staff_discount" ||
        couponType === "staff_credit" ||
        (Boolean(couponCode) && isDiscountCode(couponCode) && !isFa)

      if (isFa) {
        financialAssistance = roundMoney(financialAssistance + abs)
        if (enrollmentId) faEnrollmentIds.add(enrollmentId)
        if (couponCode) addCoupon(couponCode, "financial_assistance", abs, enrollmentId)
      } else if (isCodedDiscount) {
        discounts = roundMoney(discounts + abs)
        if (enrollmentId) discountEnrollmentIds.add(enrollmentId)
        if (couponCode) addCoupon(couponCode, "discount", abs, enrollmentId)
      } else if (type === "discount" || type === "staff_discount") {
        fullPayDiscounts = roundMoney(fullPayDiscounts + abs)
      }
    }

    const coupons = [...couponMap.values()]
      .map((row) => ({
        ...row,
        enrollmentCount: couponEnrollmentIds.get(row.code)?.size || 0,
      }))
      .sort((a, b) => a.code.localeCompare(b.code))

    if (programCharges <= 0.009) {
      for (const charge of charges) {
        if (isVoidedChargeStatus(String(charge.charge_status || ""))) continue
        programCharges = roundMoney(
          programCharges +
            Number(charge.total || 0) +
            Number(charge.discount_total || 0)
        )
      }
    }
    const discountTotal = roundMoney(discounts + fullPayDiscounts)
    const adjustedTuition = roundMoney(
      Math.max(programCharges - discountTotal - financialAssistance, 0)
    )

    const visibleOfferings = offerings.filter(
      (row) => String(row.status || "").toLowerCase() !== "archived"
    )
    let offeringsPaid = 0
    let offeringsFree = 0
    const nearCapacityNames: string[] = []
    const atCapacityNames: string[] = []
    const offeringRows: ProgramOverviewOfferingRow[] = visibleOfferings.map((row) => {
      const offeringId = row.id as string
      const enrolled = enrolledByOffering.get(offeringId) || 0
      const capacityRaw = Number(row.capacity || 0)
      const capacity = capacityRaw > 0 ? capacityRaw : null
      if (freeOfferingIds.has(offeringId)) offeringsFree += 1
      else offeringsPaid += 1
      if (capacity && enrolled >= capacity) {
        atCapacityNames.push((row.name as string) || "Offering")
      } else if (capacity && enrolled / capacity >= 0.8) {
        nearCapacityNames.push((row.name as string) || "Offering")
      }
      return {
        id: offeringId,
        name: (row.name as string) || "Offering",
        instructorName: instructorByOffering.get(offeringId) || null,
        enrolled,
        capacity,
        registrationState: getOfferingRegistrationState(
          {
            enrollment_open_date:
              (row.enrollment_open_date as string | null) || null,
            enrollment_close_date:
              (row.enrollment_close_date as string | null) || null,
          },
          programEnrollmentFallback
        ),
      }
    })
    offeringRows.sort((a, b) => {
      if (b.enrolled !== a.enrolled) return b.enrolled - a.enrolled
      return a.name.localeCompare(b.name)
    })

    const money = (value: number) => {
      const rounded = roundMoney(value)
      const whole = Math.abs(rounded - Math.round(rounded)) < 0.009
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: whole ? 0 : 2,
        maximumFractionDigits: 2,
      }).format(rounded)
    }

    const attention: ProgramOverviewAttentionItem[] = []
    if (applicationsNeedsReview > 0) {
      attention.push({
        id: "review",
        title: `${applicationsNeedsReview} application${applicationsNeedsReview === 1 ? "" : "s"} need review`,
        detail: "Open Applications to approve or send back.",
        tone: "amber",
        hrefSection: "applications",
      })
    }
    if (applicationsApprovedPending > 0) {
      attention.push({
        id: "approved",
        title: `${applicationsApprovedPending} approved, registration pending`,
        detail: "Approved applicants who have not completed registration.",
        tone: "amber",
        hrefSection: "applications",
      })
    }
    if (outstandingRows.length > 0) {
      attention.push({
        id: "balances",
        title: `${outstandingRows.length} enrollment${outstandingRows.length === 1 ? "" : "s"} have outstanding balances · ${money(outstanding)}`,
        detail: "Still due on active enrollments.",
        tone: "amber",
        hrefSection: "enrollments",
      })
    }
    if (nearCapacityNames.length > 0) {
      attention.push({
        id: "near-capacity",
        title: `${nearCapacityNames.length} offering${nearCapacityNames.length === 1 ? "" : "s"} ${nearCapacityNames.length === 1 ? "is" : "are"} nearing capacity`,
        detail: nearCapacityNames.slice(0, 3).join(", "),
        tone: "rose",
        hrefSection: "offerings",
      })
    }
    if (atCapacityNames.length > 0) {
      attention.push({
        id: "at-capacity",
        title: `${atCapacityNames.length} offering${atCapacityNames.length === 1 ? "" : "s"} ${atCapacityNames.length === 1 ? "is" : "are"} at capacity`,
        detail: atCapacityNames.slice(0, 3).join(", "),
        tone: "rose",
        hrefSection: "offerings",
      })
    }

    const enrollmentNameById = new Map(
      enrollments.map((row) => [
        row.id as string,
        String(row.child_name || "").trim() || "Student",
      ])
    )
    const activity: ProgramOverviewActivityItem[] = []
    for (const row of enrollments) {
      const at = String(row.created_at || "")
      if (!at) continue
      const name = String(row.child_name || "").trim() || "Student"
      activity.push({
        id: `enr-${row.id}`,
        at,
        kind: "registration",
        title: `Registration received — ${name}`,
      })
    }
    for (const row of applications) {
      const name = String(row.participant_name || "").trim() || "Applicant"
      const createdAt = String(row.created_at || "")
      if (createdAt) {
        activity.push({
          id: `app-${row.id}`,
          at: createdAt,
          kind: "application",
          title: `Application submitted — ${name}`,
        })
      }
      const evaluatedAt = String(row.evaluated_at || "")
      if (String(row.status || "") === "approved" && evaluatedAt) {
        activity.push({
          id: `app-approved-${row.id}`,
          at: evaluatedAt,
          kind: "approval",
          title: `Application approved — ${name}`,
        })
      }
    }
    for (const row of schedule) {
      const status = row.status.toLowerCase()
      if (status !== "paid" && status !== "refunded") continue
      const at = row.paid_at
      if (!at) continue
      const charge = chargeById.get(row.charge_id)
      const enrollmentId = (charge?.enrollment_id as string | null) || ""
      const name = enrollmentNameById.get(enrollmentId) || "family"
      activity.push({
        id: `pay-${row.charge_id}-${at}`,
        at,
        kind: "payment",
        title:
          status === "refunded"
            ? `${money(row.amount)} refunded — ${name}`
            : `${money(row.amount)} payment received — ${name}`,
      })
    }
    activity.sort((a, b) => b.at.localeCompare(a.at))
    const diversified: ProgramOverviewActivityItem[] = []
    const kindCounts = new Map<ProgramOverviewActivityKind, number>()
    for (const item of activity) {
      const used = kindCounts.get(item.kind) || 0
      if (used >= 4) continue
      kindCounts.set(item.kind, used + 1)
      diversified.push(item)
      if (diversified.length >= 10) break
    }

    return {
      success: true,
      data: {
        programId,
        programName,
        applicationsTotal: applications.length,
        applicationsNeedsReview,
        applicationsApprovedPending,
        applicationsApprovedTotal,
        applicationsNotApproved,
        enrollmentsActive,
        enrollmentsPaid,
        enrollmentsFree,
        enrollmentsCancelled,
        uniqueStudentsActive: uniqueStudents.size,
        offeringsTotal: visibleOfferings.length,
        offeringsPaid,
        offeringsFree,
        collectedGross: roundMoney(collectedGross),
        refunded: roundMoney(refunded),
        collectedNet: roundMoney(collectedGross - refunded),
        outstanding,
        outstandingEnrollmentCount: outstandingRows.length,
        programCharges: roundMoney(programCharges),
        adjustedTuition,
        financialAssistance,
        financialAssistanceCount: faEnrollmentIds.size,
        discounts,
        discountCount: discountEnrollmentIds.size,
        fullPayDiscounts,
        coupons,
        outstandingRows: outstandingRows.slice(0, 12),
        offeringRows: offeringRows.slice(0, 8),
        activity: diversified,
        attention,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load overview.",
    }
  }
}

export async function fetchProgramOverviewMetricsOrEmpty(
  departmentId: string,
  programId: string
): Promise<ProgramOverviewMetrics> {
  const result = await fetchProgramOverviewMetricsAction(departmentId, programId)
  if (result.success) return result.data
  return emptyMetrics(programId, "")
}
