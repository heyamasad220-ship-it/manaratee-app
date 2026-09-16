"use server"

import { getDepartments } from "@/lib/departments/department-queries"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  isAddonChargeType,
  isCoreProgramFeeLineType,
  isSkippedAddonLineType,
  isTransactionFeeAddon,
  resolveProgramAddonType,
  type AddonReportPaymentStatus,
  type AddonReportRow,
} from "@/lib/programs/addon-display"
import {
  PROGRAM_LABEL,
  YEAR_SEASON_LABEL,
} from "@/lib/programs/program-display-labels"
import { isOfferingCurrentlyActive } from "@/lib/programs/program-offering-display"
import { getOpenPrograms } from "@/lib/programs/program-queries"
import {
  contactLabel,
  loadContactsByIds,
} from "@/lib/programs/registration-display-helpers"
import { createClient } from "@/lib/supabase/server"

type EnrollmentRow = {
  id: string
  program_id: string | null
  offering_id: string | null
  department_id: string | null
  child_name: string | null
  parent_name: string | null
  parent_email: string | null
  parent_phone: string | null
  registrant_contact_id: string | null
  participant_contact_id: string | null
  payment_status: string | null
}

type ChargeRow = {
  id: string
  enrollment_id: string | null
  charge_type: string | null
  total: number | null
  amount_paid: number | null
  charge_status: string | null
  program_id: string | null
  offering_id: string | null
  payer_contact_id: string | null
  registrant_contact_id: string | null
  metadata: Record<string, unknown> | null
  quote_snapshot: Record<string, unknown> | null
}

type ChargeLineRow = {
  id: string
  charge_id: string
  line_type: string | null
  label: string | null
  quantity: number | null
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

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function lineIsActive(line: ChargeLineRow) {
  const status = String(line.metadata?.status || "active").toLowerCase()
  return status !== "voided"
}

function isAddonLine(line: ChargeLineRow) {
  if (!lineIsActive(line)) return false
  if (Number(line.amount || 0) <= 0.009) return false
  const type = String(line.line_type || "").toLowerCase()
  if (isSkippedAddonLineType(type) || isCoreProgramFeeLineType(type)) {
    return false
  }
  const label = String(line.label || "").toLowerCase()
  if (label.includes("discount") || label.includes("scholarship")) return false
  return true
}

function allocatePaid(paid: number, dues: number[]) {
  const totalDue = dues.reduce((sum, due) => sum + due, 0)
  if (dues.length === 0) return []
  if (totalDue <= 0.009 || paid <= 0.009) {
    return dues.map(() => 0)
  }

  const allocated = dues.map((due) => roundMoney((due / totalDue) * paid))
  const allocatedSum = allocated.reduce((sum, value) => sum + value, 0)
  const diff = roundMoney(paid - allocatedSum)
  allocated[allocated.length - 1] = roundMoney(
    allocated[allocated.length - 1] + diff
  )
  return allocated
}

function resolveAddonStatus(input: {
  amountDue: number
  amountPaid: number
  chargeStatus: string
  paymentStatus: string | null
}): AddonReportPaymentStatus {
  const chargeStatus = input.chargeStatus.toLowerCase()
  const paymentStatus = String(input.paymentStatus || "").toLowerCase()
  if (
    chargeStatus.includes("refund") ||
    paymentStatus.includes("refund") ||
    input.amountPaid < -0.009
  ) {
    return "refunded"
  }
  if (input.amountDue <= 0.009) return "paid"
  if (input.amountPaid <= 0.009) return "unpaid"
  if (input.amountPaid + 0.009 >= input.amountDue) return "paid"
  return "partial"
}

/**
 * One row per purchased add-on for Programs → Reports → Add-ons.
 */
export async function getAddonReportRows(): Promise<
  { success: true; rows: AddonReportRow[] } | { success: false; error: string }
> {
  try {
    const organizationId = await getSelectedOrganizationId()
    if (!organizationId) {
      return { success: false, error: "No organization selected." }
    }

    const supabase = await createClient()
    const [programs, departments] = await Promise.all([
      getOpenPrograms(),
      getDepartments(),
    ])
    const programIds = programs.map((program) => program.id)
    if (programIds.length === 0) {
      return { success: true, rows: [] }
    }

    const programById = new Map(programs.map((program) => [program.id, program]))
    const programNameById = new Map(
      programs.map((program) => [program.id, program.name])
    )
    const programKindById = new Map(
      programs.map((program) => [
        program.id,
        program.program_kind === "seasonal"
          ? ("seasonal" as const)
          : ("academic" as const),
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

    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from("program_enrollments")
      .select(
        `
        id,
        program_id,
        offering_id,
        department_id,
        child_name,
        parent_name,
        parent_email,
        parent_phone,
        registrant_contact_id,
        participant_contact_id,
        payment_status
      `
      )
      .eq("organization_id", organizationId)
      .in("program_id", programIds)

    if (enrollmentError) {
      return {
        success: false,
        error: enrollmentError.message || "Could not load enrollments.",
      }
    }

    const enrollments = (enrollmentData || []) as EnrollmentRow[]
    const enrollmentById = new Map(
      enrollments.map((enrollment) => [enrollment.id, enrollment])
    )
    const enrollmentIds = enrollments.map((row) => row.id)

    const [offeringRows, charges] = await Promise.all([
      supabase
        .from("program_offerings")
        .select(
          "id, name, program_id, status, start_date, end_date, enrollment_open_date, enrollment_close_date, inherit_dates"
        )
        .eq("organization_id", organizationId)
        .in("program_id", programIds)
        .neq("status", "archived"),
      fetchByIdChunks(enrollmentIds, async (chunk) => {
        const { data, error } = await supabase
          .from("program_charges")
          .select(
            "id, enrollment_id, charge_type, total, amount_paid, charge_status, program_id, offering_id, payer_contact_id, registrant_contact_id, metadata, quote_snapshot"
          )
          .eq("organization_id", organizationId)
          .in("enrollment_id", chunk)
        if (error) {
          console.error("addons report charges:", error.message)
          return []
        }
        return (data || []) as ChargeRow[]
      }),
    ])

    if (offeringRows.error) {
      console.error("addons report offerings:", offeringRows.error.message)
    }

    const offeringNameById = new Map<string, string>()
    const activeOfferingIds = new Set<string>()
    for (const offering of offeringRows.data || []) {
      const id = offering.id as string
      offeringNameById.set(id, (offering.name as string) || PROGRAM_LABEL)
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

    const activeCharges = charges.filter((charge) => {
      const status = String(charge.charge_status || "").toLowerCase()
      return status !== "void" && status !== "voided" && status !== "draft"
    })

    const lines = await fetchByIdChunks(
      activeCharges.map((charge) => charge.id),
      async (chunk) => {
        const { data, error } = await supabase
          .from("program_charge_lines")
          .select("id, charge_id, line_type, label, quantity, amount, metadata")
          .in("charge_id", chunk)
        if (error) {
          console.error("addons report charge lines:", error.message)
          return []
        }
        return (data || []) as ChargeLineRow[]
      }
    )

    const linesByChargeId = new Map<string, ChargeLineRow[]>()
    for (const line of lines) {
      const list = linesByChargeId.get(line.charge_id) || []
      list.push(line)
      linesByChargeId.set(line.charge_id, list)
    }

    const contactIds = [
      ...enrollments.flatMap((row) =>
        [row.registrant_contact_id, row.participant_contact_id].filter(
          (id): id is string => Boolean(id)
        )
      ),
      ...activeCharges.flatMap((charge) =>
        [charge.registrant_contact_id, charge.payer_contact_id].filter(
          (id): id is string => Boolean(id)
        )
      ),
    ]
    const contactsById = await loadContactsByIds(organizationId, contactIds)

    const rows: AddonReportRow[] = []

    for (const charge of activeCharges) {
      const enrollment = charge.enrollment_id
        ? enrollmentById.get(charge.enrollment_id)
        : undefined
      const chargeLines = linesByChargeId.get(charge.id) || []
      const addonLines = chargeLines.filter(isAddonLine)
      const addonCharge = isAddonChargeType(charge.charge_type)

      type PendingAddon = {
        id: string
        addonType: string
        quantity: number
        amountDue: number
      }

      const pending: PendingAddon[] = []

      if (addonLines.length > 0) {
        for (const line of addonLines) {
          const addonInput = {
            label: line.label,
            lineType: line.line_type,
            chargeType: charge.charge_type,
            metadata: {
              ...(charge.metadata || {}),
              ...(line.metadata || {}),
            },
            quote: charge.quote_snapshot,
          }
          if (isTransactionFeeAddon(addonInput)) continue
          pending.push({
            id: `line:${line.id}`,
            addonType: resolveProgramAddonType(addonInput),
            quantity: Math.max(1, Number(line.quantity || 1)),
            amountDue: roundMoney(Number(line.amount || 0)),
          })
        }
      } else if (addonCharge && Number(charge.total || 0) > 0.009) {
        const addonInput = {
          chargeType: charge.charge_type,
          metadata: charge.metadata,
          quote: charge.quote_snapshot,
        }
        if (!isTransactionFeeAddon(addonInput)) {
          pending.push({
            id: `charge:${charge.id}`,
            addonType: resolveProgramAddonType(addonInput),
            quantity: 1,
            amountDue: roundMoney(Number(charge.total || 0)),
          })
        }
      }

      if (pending.length === 0) continue

      const paidShares = allocatePaid(
        Number(charge.amount_paid || 0),
        pending.map((item) => item.amountDue)
      )

      const programId = charge.program_id || enrollment?.program_id || null
      const offeringId = charge.offering_id || enrollment?.offering_id || null
      const departmentId =
        enrollment?.department_id ||
        (programId ? programDepartmentById.get(programId) || null : null)
      const registrantId =
        charge.registrant_contact_id ||
        enrollment?.registrant_contact_id ||
        charge.payer_contact_id ||
        null
      const registrant = registrantId ? contactsById.get(registrantId) : undefined

      for (let index = 0; index < pending.length; index += 1) {
        const item = pending[index]
        const amountPaid = paidShares[index] || 0
        const amountDue = item.amountDue
        const balance = Math.max(0, roundMoney(amountDue - amountPaid))
        const status = resolveAddonStatus({
          amountDue,
          amountPaid,
          chargeStatus: charge.charge_status || "",
          paymentStatus: enrollment?.payment_status || null,
        })

        rows.push({
          id: item.id,
          contactName: contactLabel(
            registrant,
            enrollment?.parent_name || "Unknown contact"
          ),
          contactProfileId: registrantId,
          contactEmail: registrant?.email || enrollment?.parent_email || null,
          contactPhone: registrant?.phone || enrollment?.parent_phone || null,
          participantName: enrollment?.child_name?.trim() || "Participant",
          programId,
          programName: programId
            ? programNameById.get(programId) || YEAR_SEASON_LABEL
            : YEAR_SEASON_LABEL,
          programKind: programId
            ? programKindById.get(programId) || "academic"
            : "academic",
          offeringId,
          offeringName: offeringId
            ? offeringNameById.get(offeringId) || PROGRAM_LABEL
            : PROGRAM_LABEL,
          offeringActivity:
            offeringId && activeOfferingIds.has(offeringId)
              ? "active"
              : "closed",
          departmentId,
          departmentName: departmentId
            ? departmentNameById.get(departmentId) || "Department"
            : "No department",
          addonType: item.addonType,
          quantity: item.quantity,
          amountDue,
          amountPaid,
          balance,
          status,
        })
      }
    }

    rows.sort((a, b) => {
      const contact = a.contactName.localeCompare(b.contactName)
      if (contact !== 0) return contact
      const participant = a.participantName.localeCompare(b.participantName)
      if (participant !== 0) return participant
      return a.addonType.localeCompare(b.addonType)
    })

    return { success: true, rows }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not load add-on purchases.",
    }
  }
}
