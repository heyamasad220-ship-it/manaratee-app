"use server"

import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  PROGRAM_LABEL,
  YEAR_SEASON_LABEL,
} from "@/lib/programs/program-display-labels"
import { getOpenPrograms } from "@/lib/programs/program-queries"
import {
  formatMonthsTimesFee,
  summarizeInstallments,
} from "@/lib/programs/registration-report-helpers"
import {
  contactLabel,
  loadContactsByIds,
} from "@/lib/programs/registration-display-helpers"
import {
  enrollmentShowsContact,
  isFreeOfferingFeePlan,
  isPaymentSummaryEnrollment,
  isYouthEnrollment,
} from "@/lib/programs/payment-summary-report-helpers"
import { createClient } from "@/lib/supabase/server"

export type PaymentSummaryStatus = "paid" | "partial" | "unpaid" | "refunded"

export type PaymentSummaryFeeLine = {
  label: string
  type: string
}

export type PaymentSummaryParticipant = {
  name: string
  contactId: string | null
  email: string | null
  phone: string | null
  isYouth: boolean
}

export type PaymentSummaryRow = {
  id: string
  contactName: string
  contactProfileId: string | null
  contactEmail: string | null
  contactPhone: string | null
  /** Parent / payer column — youth, or an adult registered by someone else. */
  showsContact: boolean
  participantNames: string[]
  participants: PaymentSummaryParticipant[]
  programFeeLines: string[]
  additionalFeeLines: PaymentSummaryFeeLine[]
  received: number
  balance: number
  status: PaymentSummaryStatus
  programId: string | null
  programName: string
  programKind: "academic" | "seasonal"
  offeringIds: string[]
  offeringNames: string[]
}

type EnrollmentRow = {
  id: string
  program_id: string | null
  offering_id: string | null
  child_name: string | null
  child_person_id: string | null
  participant_contact_id: string | null
  parent_name: string | null
  parent_email: string | null
  parent_phone: string | null
  registrant_contact_id: string | null
  payment_status: string | null
  payment_required: boolean | null
  total_amount: number | null
  amount_paid: number | null
}

type ChargeRow = {
  id: string
  enrollment_id: string | null
  charge_type: string | null
  total: number | null
  amount_paid: number | null
  charge_status: string | null
  metadata: Record<string, unknown> | null
  quote_snapshot: Record<string, unknown> | null
}

type ChargeLineRow = {
  charge_id: string
  line_type: string | null
  label: string | null
  quantity: number | null
  unit_amount: number | null
  amount: number | null
  metadata: Record<string, unknown> | null
}

async function fetchByIdChunks<T>(
  ids: string[],
  fetchChunk: (chunk: string[]) => Promise<T[]>
): Promise<T[]> {
  if (ids.length === 0) return []
  const rows: T[] = []
  const chunkSize = 150
  for (let i = 0; i < ids.length; i += chunkSize) {
    rows.push(...(await fetchChunk(ids.slice(i, i + chunkSize))))
  }
  return rows
}

function titleCaseLabel(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return "Additional fee"
  return trimmed.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase())
}

function additionalFeeType(input: {
  label?: string | null
  lineType?: string | null
  chargeType?: string | null
  metadata?: Record<string, unknown> | null
  quote?: Record<string, unknown> | null
}) {
  const meta = input.metadata || {}
  const quote = input.quote || {}
  const raw = [
    input.label,
    input.lineType,
    typeof meta.label === "string" ? meta.label : null,
    typeof meta.addon_kind === "string" ? meta.addon_kind : null,
    typeof quote.type === "string" ? quote.type : null,
    input.chargeType,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  if (raw.includes("lunch")) return "Lunch"
  if (
    raw.includes("childcare") ||
    raw.includes("child care") ||
    raw.includes("before care") ||
    raw.includes("after care") ||
    raw.includes("extended care")
  ) {
    return "Childcare"
  }
  if (raw.includes("transaction")) return "Transaction fee"
  if (raw.includes("material")) return "Materials"

  const label =
    (typeof meta.label === "string" && meta.label.trim()) ||
    input.label?.trim() ||
    input.lineType?.trim() ||
    "Additional fee"
  return titleCaseLabel(label)
}

function resolvePaymentSummaryStatus(input: {
  total: number
  received: number
  paymentStatuses: string[]
}): PaymentSummaryStatus {
  const refunded = input.paymentStatuses.some((status) =>
    status.includes("refund")
  )
  if (refunded) return "refunded"
  if (input.received < -0.009) return "refunded"
  if (input.total <= 0.009) return "paid"
  if (input.received <= 0.009) return "unpaid"
  if (input.received + 0.009 >= input.total) return "paid"
  return "partial"
}

function monthsTimesFromTotal(total: number, monthsHint: number) {
  if (total <= 0.009) return null
  if (monthsHint > 1) {
    const monthly = Math.round((total / monthsHint) * 100) / 100
    if (Math.abs(monthly * monthsHint - total) < 0.05) {
      return { months: monthsHint, monthlyFee: monthly }
    }
  }
  return { months: 1, monthlyFee: total }
}

/**
 * Family/contact payment rollup for Programs Finance → Payment Summary
 * (org-wide list remains `/programs/reports/tuition-plans`).
 */
export async function getPaymentSummaryRows(): Promise<
  { success: true; rows: PaymentSummaryRow[] } | { success: false; error: string }
> {
  try {
    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false, error: "No organization selected." }
    }

    const supabase = await createClient()
    const programs = await getOpenPrograms()
    const programIds = programs.map((program) => program.id)
    if (programIds.length === 0) {
      return { success: true, rows: [] }
    }

    const programNameById = new Map(
      programs.map((program) => [program.id, program.name])
    )
    const programKindById = new Map(
      programs.map((program) => [
        program.id,
        program.program_kind === "seasonal" ? "seasonal" : "academic",
      ] as const)
    )

    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from("program_enrollments")
      .select(
        `
        id,
        program_id,
        offering_id,
        child_name,
        child_person_id,
        participant_contact_id,
        parent_name,
        parent_email,
        parent_phone,
        registrant_contact_id,
        payment_status,
        payment_required,
        total_amount,
        amount_paid
      `
      )
      .eq("organization_id", organizationId)
      .in("program_id", programIds)
      .order("created_at", { ascending: false })

    if (enrollmentError) {
      return {
        success: false,
        error: enrollmentError.message || "Could not load enrollments.",
      }
    }

    const allEnrollments = (enrollmentData || []) as EnrollmentRow[]
    const offeringIds = [
      ...new Set(
        allEnrollments
          .map((row) => row.offering_id)
          .filter((id): id is string => Boolean(id))
      ),
    ]

    const feePlanRows =
      offeringIds.length === 0
        ? []
        : await fetchByIdChunks(offeringIds, async (chunk) => {
            const { data, error } = await supabase
              .from("program_offering_fee_plans")
              .select("offering_id, plan_type, is_default, is_active, metadata")
              .eq("organization_id", organizationId)
              .in("offering_id", chunk)
            if (error) {
              console.error("payment summary fee plans:", error.message)
              return []
            }
            return (data || []) as Array<{
              offering_id: string | null
              plan_type: string | null
              is_default: boolean | null
              is_active: boolean | null
              metadata: Record<string, unknown> | null
            }>
          })

    const defaultPlanByOffering = new Map<
      string,
      { planType: string; tuition: number | null }
    >()
    for (const row of feePlanRows) {
      if (row.is_active === false || !row.offering_id) continue
      const tuitionRaw = Number(row.metadata?.total_tuition ?? NaN)
      const tuition = Number.isFinite(tuitionRaw) ? tuitionRaw : null
      const current = defaultPlanByOffering.get(row.offering_id)
      if (!current || row.is_default === true) {
        defaultPlanByOffering.set(row.offering_id, {
          planType: String(row.plan_type || ""),
          tuition,
        })
      }
    }

    const enrollments = allEnrollments.filter((enrollment) => {
      const plan = enrollment.offering_id
        ? defaultPlanByOffering.get(enrollment.offering_id)
        : undefined
      return isPaymentSummaryEnrollment({
        offeringIsFree: isFreeOfferingFeePlan(plan),
        paymentRequired: enrollment.payment_required,
        totalAmount: enrollment.total_amount,
        amountPaid: enrollment.amount_paid,
      })
    })
    const enrollmentIds = enrollments.map((row) => row.id)

    const [offeringRows, planRows, charges, contactMap] = await Promise.all([
      offeringIds.length === 0
        ? Promise.resolve([] as Array<{ id: string; name: string | null }>)
        : fetchByIdChunks(offeringIds, async (chunk) => {
            const { data, error } = await supabase
              .from("program_offerings")
              .select("id, name")
              .eq("organization_id", organizationId)
              .in("id", chunk)
            if (error) {
              console.error("payment summary offerings:", error.message)
              return []
            }
            return (data || []) as Array<{ id: string; name: string | null }>
          }),
      fetchByIdChunks(enrollmentIds, async (chunk) => {
        const { data, error } = await supabase
          .from("program_payment_plans")
          .select("enrollment_id, installment_amount")
          .in("enrollment_id", chunk)
        if (error) {
          console.error("payment summary plans:", error.message)
          return []
        }
        return (data || []) as Array<{
          enrollment_id: string | null
          installment_amount: number | null
        }>
      }),
      fetchByIdChunks(enrollmentIds, async (chunk) => {
        const { data, error } = await supabase
          .from("program_charges")
          .select(
            "id, enrollment_id, charge_type, total, amount_paid, charge_status, metadata, quote_snapshot"
          )
          .eq("organization_id", organizationId)
          .in("enrollment_id", chunk)
        if (error) {
          console.error("payment summary charges:", error.message)
          return []
        }
        return (data || []) as ChargeRow[]
      }),
      loadContactsByIds(
        organizationId,
        enrollments.flatMap((row) => [
          row.registrant_contact_id,
          row.participant_contact_id,
        ])
      ),
    ])

    const offeringNameById = new Map(
      offeringRows.map((row) => [row.id, row.name?.trim() || PROGRAM_LABEL])
    )

    const plansByEnrollment = new Map<string, number[]>()
    for (const plan of planRows) {
      if (!plan.enrollment_id) continue
      const list = plansByEnrollment.get(plan.enrollment_id) || []
      list.push(Number(plan.installment_amount || 0))
      plansByEnrollment.set(plan.enrollment_id, list)
    }

    const chargesByEnrollment = new Map<string, ChargeRow[]>()
    for (const charge of charges) {
      const status = String(charge.charge_status || "").toLowerCase()
      if (status === "void" || status === "voided") continue
      if (!charge.enrollment_id) continue
      const list = chargesByEnrollment.get(charge.enrollment_id) || []
      list.push(charge)
      chargesByEnrollment.set(charge.enrollment_id, list)
    }

    const chargeIds = charges.map((charge) => charge.id)
    const lines = await fetchByIdChunks(chargeIds, async (chunk) => {
      const { data, error } = await supabase
        .from("program_charge_lines")
        .select(
          "charge_id, line_type, label, quantity, unit_amount, amount, metadata"
        )
        .in("charge_id", chunk)
      if (error) {
        console.error("payment summary charge lines:", error.message)
        return []
      }
      return (data || []) as ChargeLineRow[]
    })

    const linesByChargeId = new Map<string, ChargeLineRow[]>()
    for (const line of lines) {
      const status = String(line.metadata?.status || "active").toLowerCase()
      if (status === "voided") continue
      const list = linesByChargeId.get(line.charge_id) || []
      list.push(line)
      linesByChargeId.set(line.charge_id, list)
    }

    const groups = new Map<string, EnrollmentRow[]>()
    for (const enrollment of enrollments) {
      const registrant = enrollment.registrant_contact_id
        ? contactMap.get(enrollment.registrant_contact_id)
        : undefined
      const contactKey =
        enrollment.registrant_contact_id ||
        (registrant?.email
          ? `email:${registrant.email.toLowerCase()}`
          : null) ||
        (enrollment.parent_email
          ? `email:${enrollment.parent_email.toLowerCase()}`
          : null) ||
        (enrollment.parent_phone ? `phone:${enrollment.parent_phone}` : null) ||
        `name:${enrollment.parent_name || enrollment.id}`
      const key = `${enrollment.program_id || "none"}|${contactKey}`
      const list = groups.get(key) || []
      list.push(enrollment)
      groups.set(key, list)
    }

    const rows: PaymentSummaryRow[] = [...groups.entries()].map(
      ([groupKey, members]) => {
        const primary = members[0]
        const registrant = primary.registrant_contact_id
          ? contactMap.get(primary.registrant_contact_id)
          : undefined

        const offeringIdList: string[] = []
        const offeringNameList: string[] = []
        for (const member of members) {
          if (!member.offering_id || offeringIdList.includes(member.offering_id)) {
            continue
          }
          offeringIdList.push(member.offering_id)
          offeringNameList.push(
            offeringNameById.get(member.offering_id) || PROGRAM_LABEL
          )
        }

        const participants: PaymentSummaryParticipant[] = []
        const seenPeople = new Set<string>()
        const participantNames: string[] = []
        const programFeeLines: string[] = []
        const additionalByType = new Map<string, number>()
        let received = 0
        let total = 0
        const paymentStatuses: string[] = []
        let familyMonthsHint = 0
        let showsContact = false

        for (const member of members) {
          const studentContactId = member.participant_contact_id
          const studentContact = studentContactId
            ? contactMap.get(studentContactId)
            : undefined
          const isYouth = isYouthEnrollment({
            childPersonId: member.child_person_id,
            participantContactId: studentContactId,
          })
          if (
            enrollmentShowsContact({
              childPersonId: member.child_person_id,
              participantContactId: studentContactId,
              registrantContactId: member.registrant_contact_id,
            })
          ) {
            showsContact = true
          }

          const personKey =
            member.child_person_id ||
            studentContactId ||
            member.child_name ||
            member.id
          if (!seenPeople.has(personKey)) {
            seenPeople.add(personKey)
            participants.push({
              name: contactLabel(studentContact, member.child_name),
              contactId: isYouth ? null : studentContactId,
              email: isYouth ? null : studentContact?.email?.trim() || null,
              phone: isYouth ? null : studentContact?.phone?.trim() || null,
              isYouth,
            })
          }

          const memberCharges = chargesByEnrollment.get(member.id) || []
          const planAmounts = plansByEnrollment.get(member.id) || []
          const planSummary = summarizeInstallments(planAmounts)
          if (planSummary.months > familyMonthsHint) {
            familyMonthsHint = planSummary.months
          }

          const registrationCharges = memberCharges.filter(
            (charge) =>
              String(charge.charge_type || "").toLowerCase() === "registration"
          )
          const registrationTotal = registrationCharges.reduce(
            (sum, charge) => sum + Number(charge.total || 0),
            0
          )

          const name =
            contactLabel(studentContact, member.child_name).trim() ||
            "Participant"
          if (!participantNames.includes(name)) {
            participantNames.push(name)
            if (planSummary.months > 0 && planSummary.monthlyFee > 0) {
              programFeeLines.push(
                formatMonthsTimesFee(planSummary.months, planSummary.monthlyFee)
              )
            } else if (registrationTotal > 0.009) {
              const meta = registrationCharges[0]?.metadata || {}
              const planCount = Number(meta.plan_count || 0)
              const planInstallment = Number(meta.plan_installment || 0)
              if (planCount > 1 && planInstallment > 0) {
                programFeeLines.push(
                  formatMonthsTimesFee(planCount, planInstallment)
                )
              } else {
                programFeeLines.push(formatMonthsTimesFee(1, registrationTotal))
              }
            } else {
              programFeeLines.push("—")
            }
          }

          if (memberCharges.length === 0) {
            total += Number(member.total_amount || 0)
            received += Number(member.amount_paid || 0)
          }

          for (const charge of memberCharges) {
            total += Number(charge.total || 0)
            received += Number(charge.amount_paid || 0)
            const type = String(charge.charge_type || "").toLowerCase()
            if (type !== "addon" && type !== "fee") continue

            const chargeLines = linesByChargeId.get(charge.id) || []
            const activeLines = chargeLines.filter(
              (line) => Number(line.amount || 0) > 0.009
            )

            if (activeLines.length > 0) {
              for (const line of activeLines) {
                const feeType = additionalFeeType({
                  label: line.label,
                  lineType: line.line_type,
                  chargeType: charge.charge_type,
                  metadata: {
                    ...(charge.metadata || {}),
                    ...(line.metadata || {}),
                  },
                  quote: charge.quote_snapshot,
                })
                const amount = Number(line.amount || 0)
                additionalByType.set(
                  feeType,
                  (additionalByType.get(feeType) || 0) + amount
                )
              }
            } else if (Number(charge.total || 0) > 0.009) {
              const feeType = additionalFeeType({
                chargeType: charge.charge_type,
                metadata: charge.metadata,
                quote: charge.quote_snapshot,
              })
              additionalByType.set(
                feeType,
                (additionalByType.get(feeType) || 0) + Number(charge.total || 0)
              )
            }
          }

          if (member.payment_status) {
            paymentStatuses.push(member.payment_status.toLowerCase())
          }
        }

        const additionalFeeLines: PaymentSummaryFeeLine[] = [
          ...additionalByType.entries(),
        ].map(([type, amount]) => {
          const recurring =
            type === "Lunch" ||
            type === "Childcare" ||
            type.toLowerCase().includes("care")
          const inferred = recurring
            ? monthsTimesFromTotal(amount, familyMonthsHint)
            : { months: 1, monthlyFee: amount }
          return {
            type,
            label: formatMonthsTimesFee(
              inferred?.months || 1,
              inferred?.monthlyFee || amount
            ),
          }
        })

        const balance = Math.max(0, total - received)
        const status = resolvePaymentSummaryStatus({
          total,
          received,
          paymentStatuses,
        })

        return {
          id: groupKey,
          contactName: contactLabel(
            registrant,
            primary.parent_name || "Unknown contact"
          ),
          contactProfileId: primary.registrant_contact_id,
          contactEmail: registrant?.email || primary.parent_email || null,
          contactPhone: registrant?.phone || primary.parent_phone || null,
          showsContact,
          participantNames,
          participants,
          programFeeLines,
          additionalFeeLines,
          received,
          balance,
          status,
          programId: primary.program_id,
          programName: primary.program_id
            ? programNameById.get(primary.program_id) || YEAR_SEASON_LABEL
            : YEAR_SEASON_LABEL,
          programKind: primary.program_id
            ? programKindById.get(primary.program_id) || "academic"
            : "academic",
          offeringIds: offeringIdList,
          offeringNames: offeringNameList,
        }
      }
    )

    rows.sort((a, b) => a.contactName.localeCompare(b.contactName))
    return { success: true, rows }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not load payment summary.",
    }
  }
}
