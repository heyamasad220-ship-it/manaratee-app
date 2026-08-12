import { createClient } from "@/lib/supabase/server"
import type {
  OfferingBillingScheduleBundle,
  ParticipantBillingRow,
  ProgramBillingOverride,
  ProgramChargeScheduleItemExtended,
  ProgramOfferingBillingPeriod,
} from "@/lib/programs/program-billing-types"
import {
  isBillingSchemaMissingError,
} from "@/lib/programs/program-billing-schema"
import { getDefaultOfferingForProgram } from "@/lib/programs/program-offering-queries"
import { contactLabel, loadContactsByIds } from "@/lib/programs/registration-display-helpers"
import { billingDayFromStartDate } from "@/lib/programs/program-billing-utils"

export type OfferingBillingScheduleResult = {
  migrationRequired: boolean
  bundle: OfferingBillingScheduleBundle | null
}

async function probeBillingCalendarSchema(organizationId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from("program_offering_billing_periods")
    .select("id")
    .eq("organization_id", organizationId)
    .limit(1)

  if (error && isBillingSchemaMissingError(error.message)) {
    return false
  }

  return !error
}

export async function syncOfferingBillingPeriods(
  organizationId: string,
  offeringId: string,
  defaultTuitionAmount?: number | null,
  paymentDueDay?: number | null
) {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc("sync_offering_billing_periods", {
    p_organization_id: organizationId,
    p_offering_id: offeringId,
    p_default_tuition_amount: defaultTuitionAmount ?? null,
    p_payment_due_day: paymentDueDay ?? null,
  })

  if (error) {
    if (isBillingSchemaMissingError(error.message)) {
      return 0
    }

    throw new Error(error.message)
  }

  return data as number
}

export async function getOfferingBillingPeriods(
  organizationId: string,
  offeringId: string
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("program_offering_billing_periods")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("offering_id", offeringId)
    .order("sequence_number", { ascending: true })

  if (error) {
    if (isBillingSchemaMissingError(error.message)) {
      return []
    }

    throw new Error(error.message)
  }

  return (data || []) as ProgramOfferingBillingPeriod[]
}

export async function getOfferingBillingOverrides(
  organizationId: string,
  offeringId: string
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("program_billing_overrides")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("offering_id", offeringId)
    .order("created_at", { ascending: false })

  if (error) {
    if (isBillingSchemaMissingError(error.message)) {
      return []
    }

    throw new Error(error.message)
  }

  return (data || []) as ProgramBillingOverride[]
}

export async function getOfferingBillingScheduleBundle(
  programId: string,
  organizationId: string,
  offeringId?: string | null,
  options?: { includeParticipants?: boolean }
): Promise<OfferingBillingScheduleResult> {
  const includeParticipants = options?.includeParticipants ?? true
  const supabase = await createClient()
  let offering = null

  if (offeringId) {
    const { data } = await supabase
      .from("program_offerings")
      .select("*")
      .eq("id", offeringId)
      .eq("program_id", programId)
      .eq("organization_id", organizationId)
      .maybeSingle()

    offering = data
  }

  if (!offering) {
    offering = await getDefaultOfferingForProgram(programId)
  }

  if (!offering) {
    return { migrationRequired: false, bundle: null }
  }

  const billingCalendarReady = await probeBillingCalendarSchema(organizationId)

  const monthlyPlan = await supabase
    .from("program_offering_fee_plans")
    .select("payment_due_day, id")
    .eq("organization_id", organizationId)
    .eq("offering_id", offering.id)
    .eq("plan_type", "monthly")
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle()

  let monthlyTuition: number | null = null

  if (monthlyPlan.data?.id) {
    const { data: tuitionComponent } = await supabase
      .from("program_offering_fee_plan_components")
      .select("amount")
      .eq("fee_plan_id", monthlyPlan.data.id)
      .eq("component_type", "tuition")
      .eq("pricing_model", "per_month")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle()

    monthlyTuition = tuitionComponent?.amount ?? null
  }

  if (
    billingCalendarReady &&
    offering.start_date &&
    offering.end_date
  ) {
    try {
      const billingDay =
        billingDayFromStartDate(offering.start_date) ??
        monthlyPlan.data?.payment_due_day ??
        null
      await syncOfferingBillingPeriods(
        organizationId,
        offering.id,
        monthlyTuition,
        billingDay
      )
    } catch (error) {
      console.error("syncOfferingBillingPeriods:", error)
    }
  }

  const enrollmentsResult = includeParticipants
    ? await supabase
        .from("program_enrollments")
        .select(
          `
      id,
      charge_id,
      child_name,
      participant_contact_id,
      status,
      program_charges:charge_id (
        id,
        total,
        amount_paid,
        due_today
      )
    `
        )
        .eq("organization_id", organizationId)
        .eq("offering_id", offering.id)
        .in("status", [
          "pending_payment",
          "pending",
          "enrolled",
          "active",
          "completed",
        ])
        .order("child_name", { ascending: true })
    : { data: [] }

  const billingPeriods = billingCalendarReady
    ? await getOfferingBillingPeriods(organizationId, offering.id)
    : []

  const overrides =
    includeParticipants && billingCalendarReady
      ? await getOfferingBillingOverrides(organizationId, offering.id)
      : []

  const enrollments = enrollmentsResult.data || []
  const chargeIds = enrollments
    .map((row) => row.charge_id as string | null)
    .filter(Boolean) as string[]

  const scheduleByChargeId = new Map<string, ProgramChargeScheduleItemExtended[]>()

  if (chargeIds.length > 0) {
    const { data: scheduleRows, error: scheduleError } = await supabase
      .from("program_charge_schedule")
      .select("*")
      .eq("organization_id", organizationId)
      .in("charge_id", chargeIds)
      .order("sequence_number", { ascending: true })

    if (scheduleError && !isBillingSchemaMissingError(scheduleError.message)) {
      throw new Error(scheduleError.message)
    }

    for (const row of scheduleRows || []) {
      const chargeId = row.charge_id as string
      const existing = scheduleByChargeId.get(chargeId) || []
      existing.push(row as ProgramChargeScheduleItemExtended)
      scheduleByChargeId.set(chargeId, existing)
    }
  }

  const contactsById = await loadContactsByIds(
    organizationId,
    enrollments.map((row) => row.participant_contact_id as string).filter(Boolean)
  )

  const participants: ParticipantBillingRow[] = enrollments.map((row) => {
    const charge = row.program_charges as {
      id: string
      total: number
      amount_paid: number
      due_today: number
    } | null

    const scheduleItems = row.charge_id
      ? scheduleByChargeId.get(row.charge_id as string) || []
      : []

    const balanceTotal = scheduleItems.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      charge ? Number(charge.total || 0) : 0
    )

    const balancePaid = scheduleItems
      .filter((item) => item.status === "paid")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0)

    const balanceDue = scheduleItems
      .filter((item) => !["paid", "waived", "void"].includes(item.status))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0)

    return {
      enrollment_id: row.id as string,
      charge_id: (row.charge_id as string | null) || null,
      participant_name: contactLabel(
        row.participant_contact_id
          ? contactsById.get(row.participant_contact_id as string)
          : undefined,
        row.child_name as string
      ),
      status: row.status as string | null,
      balance_due: balanceDue,
      balance_paid: balancePaid,
      balance_total: balanceTotal,
      schedule_items: scheduleItems,
    }
  })

  return {
    migrationRequired: !billingCalendarReady,
    bundle: {
      offering: {
        id: offering.id,
        name: offering.name,
        start_date: offering.start_date,
        end_date: offering.end_date,
      },
      billing_periods: billingPeriods,
      participants,
      overrides,
    },
  }
}

export async function getEnrollmentChargeSchedule(
  organizationId: string,
  enrollmentId: string
) {
  const supabase = await createClient()

  const { data: enrollment } = await supabase
    .from("program_enrollments")
    .select("charge_id")
    .eq("organization_id", organizationId)
    .eq("id", enrollmentId)
    .maybeSingle()

  if (!enrollment?.charge_id) {
    return []
  }

  const { data, error } = await supabase
    .from("program_charge_schedule")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("charge_id", enrollment.charge_id)
    .order("sequence_number", { ascending: true })

  if (error) {
    if (isBillingSchemaMissingError(error.message)) {
      return []
    }

    throw new Error(error.message)
  }

  return (data || []) as ProgramChargeScheduleItemExtended[]
}
