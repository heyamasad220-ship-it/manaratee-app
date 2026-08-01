"use server"

import {
  formatFinancialActivityPaymentStatus,
  pledgeDisplayStatus,
} from "@/lib/donations/donation-status"
import { donationPaymentDetailHref } from "@/lib/donations/donation-payment-paths"
import { donationPledgesHref } from "@/lib/donations/donation-pledge-paths"
import { normalizePaymentSourceChannel } from "@/lib/donations/payment-source-channel"
import {
  loadStripeCardLast4ByPaymentIntentIds,
  resolvePaymentMethodDisplayLabel,
} from "@/lib/donations/payment-method-display"
import {
  countsTowardGivingTotals,
  paymentNetAmount,
} from "@/lib/donations/payment-net-amount"
import { formatRecurringFrequencyLabel } from "@/lib/donations/recurring-donation-types"
import { getVenueRentalStatusLabel } from "@/lib/bookings/venue-rental-status"
import {
  RENTAL_PAYMENT_STATUSES,
  RENTAL_PAYMENT_TYPES,
  type RentalPaymentRecord,
  type VenueRentalStatus,
} from "@/lib/bookings/venue-rental-types"
import type { LoadContactFinancialSummaryInput } from "@/lib/contacts/contact-financial-types"
import type {
  ContactFinancialFilter,
  ContactFinancialSummaryPayload,
  ContactFinancialTimelineEvent,
  ContactOpenBalanceRow,
} from "@/lib/contacts/contact-financial-types"
import type { ContactProfileModuleFlags } from "@/lib/contacts/contact-profile-module-access"
import { ensureDonorExtensionForContact } from "@/lib/donations/donor-contact-bridge"
import { loadMemberContactsByIds } from "@/lib/contacts/group-membership-data"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
import { hasPermission } from "@/lib/permissions/permissions"
import { getActiveFaAwardsByEnrollmentIds } from "@/lib/programs/fa-awards"
import { createClient } from "@/lib/supabase/server"

const PAID_RENTAL_STATUSES = new Set<string>([
  RENTAL_PAYMENT_STATUSES.paidManually,
  RENTAL_PAYMENT_STATUSES.paidStripeLater,
])

function latestDate(dates: (string | null | undefined)[]) {
  const parsed = dates
    .map((value) => (value ? new Date(value).getTime() : NaN))
    .filter((value) => Number.isFinite(value))
  if (parsed.length === 0) return null
  return new Date(Math.max(...parsed)).toISOString()
}

function rentalPaymentLabel(paymentType: string) {
  switch (paymentType) {
    case RENTAL_PAYMENT_TYPES.deposit:
      return "Deposit"
    case RENTAL_PAYMENT_TYPES.securityDeposit:
      return "Security deposit"
    case RENTAL_PAYMENT_TYPES.remainingBalance:
      return "Remaining balance"
    case RENTAL_PAYMENT_TYPES.addonFee:
      return "Add-on fee"
    case RENTAL_PAYMENT_TYPES.refund:
      return "Refund"
    default:
      return paymentType.replace(/_/g, " ")
  }
}

function formatPaymentMethod(
  payment: {
    source?: string | null
    stripe_payment_intent_id?: string | null
  },
  stripeCardLast4ByIntentId: Map<string, string>
) {
  return resolvePaymentMethodDisplayLabel(payment, stripeCardLast4ByIntentId)
}

async function loadStripeCardLast4ForPayments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  paymentIntentIds: string[]
) {
  return loadStripeCardLast4ByPaymentIntentIds(supabase, organizationId, paymentIntentIds)
}

const ACTIVITY_TYPE_LABELS = {
  donation: "Donation",
  pledge: "Pledge",
  programs: "Programs",
  venue_rentals: "Venue Rental",
  membership: "Membership",
  other: "Other",
} as const

function activityTypeLabel(kind: keyof typeof ACTIVITY_TYPE_LABELS) {
  return ACTIVITY_TYPE_LABELS[kind]
}

function describeDonationPayment(payment: {
  recurring_donation_plan_id?: string | null
  recurring_frequency?: string | null
  memo?: string | null
}) {
  const memo = String(payment.memo || "")
  if (payment.recurring_donation_plan_id || memo.includes("|recurring|")) {
    if (payment.recurring_frequency) {
      return `${formatRecurringFrequencyLabel(payment.recurring_frequency)} Recurring Donation`
    }
    return "Recurring Donation"
  }
  return "One-Time Donation"
}

function formatPledgeTimelineStatusLabel(
  status: string | null | undefined,
  amountPledged: number,
  amountPaid: number
) {
  const normalized = status?.toLowerCase()
  if (normalized === "cancelled") return "Cancelled"

  return pledgeDisplayStatus(status, amountPledged, amountPaid)
}

function describePledge(campaignName: string) {
  const campaign = campaignName.trim()
  return campaign || "Pledge"
}

function isMissingTableError(error: { code?: string; message?: string } | null) {
  return error?.code === "42P01"
}

export async function loadContactFinancialSummaryAction(
  input: LoadContactFinancialSummaryInput
): Promise<
  { success: true; data: ContactFinancialSummaryPayload } | { success: false; error: string }
> {
  const allowed = await hasPermission(PERMISSIONS.CONTACTS_VIEW)
  if (!allowed) {
    return { success: false, error: "Not authorized to view contact financial activity." }
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false, error: "No organization selected." }
  }

  const supabase = await createClient()
  return buildContactFinancialSummary(supabase, organizationId, input, "staff")
}

export async function loadCustomerMyTransactionsSummaryAction(): Promise<
  | {
      success: true
      data: ContactFinancialSummaryPayload
      contactId: string
      contactName: string
      contactEmail: string | null
      contactPhone: string | null
      donorId: string | null
      personId: string | null
      modules: ContactProfileModuleFlags
    }
  | { success: false; error: string }
> {
  const { getCustomerPortalSupabase } = await import("@/lib/auth/customer-portal-session")
  const { getActiveOrganization } = await import("@/lib/organizations/get-active-organization")
  const { loadCustomerPortalEnabledModuleSlugs } = await import(
    "@/lib/customer/customer-portal-modules-server"
  )
  const {
    getContactProfileModuleFlags,
    showContactFinancialSurfaces,
  } = await import("@/lib/contacts/contact-profile-module-access")

  const { supabase, session } = await getCustomerPortalSupabase()
  const { activeOrganization } = await getActiveOrganization()

  if (!activeOrganization) {
    return { success: false, error: "No organization selected." }
  }

  const organizationId = activeOrganization.organization_id
  const enabledSlugs = await loadCustomerPortalEnabledModuleSlugs(organizationId, supabase)
  const modules = getContactProfileModuleFlags(enabledSlugs)

  if (!showContactFinancialSurfaces(modules)) {
    return { success: false, error: "No financial modules are enabled for this organization." }
  }

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id, full_name, email, phone, person_id")
    .eq("auth_user_id", session.effectiveUserId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (contactError || !contact) {
    return { success: false, error: "Contact not found." }
  }

  const contactId = contact.id as string
  const personId = (contact.person_id as string | null) ?? null

  let donorId: string | null = null
  if (modules.donations) {
    const { data: donorRow } = await supabase
      .from("donors")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("contact_id", contactId)
      .maybeSingle()
    donorId = (donorRow?.id as string | null) ?? null
  }

  const result = await buildContactFinancialSummary(
    supabase,
    organizationId,
    {
      contactId,
      donorId,
      personId,
      modules,
      isGroup: false,
    },
    "customer"
  )

  if (!result.success) {
    return result
  }

  return {
    success: true,
    data: result.data,
    contactId,
    contactName: (contact.full_name as string | null)?.trim() || "You",
    contactEmail: (contact.email as string | null) ?? null,
    contactPhone: (contact.phone as string | null) ?? null,
    donorId,
    personId,
    modules,
  }
}

async function buildContactFinancialSummary(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  input: LoadContactFinancialSummaryInput,
  audience: "staff" | "customer"
): Promise<
  { success: true; data: ContactFinancialSummaryPayload } | { success: false; error: string }
> {
  const { contactId, donorId, personId, modules, isGroup = false } = input

  const openBalances: ContactOpenBalanceRow[] = []
  const timeline: ContactFinancialTimelineEvent[] = []
  const availableFilters = new Set<ContactFinancialFilter>(["all"])

  let donationPaidTotal = 0
  let lifetimeContributions = 0
  let otherPaidTotal = 0
  let outstandingBalance = 0
  const activityDates: string[] = []

  let programsReady = false
  let rentalsReady = false
  const membershipReady = false

  let resolvedDonorId = donorId ?? null
  if (modules.donations) {
    availableFilters.add("pledges")

    if (!resolvedDonorId) {
      resolvedDonorId = await ensureDonorExtensionForContact(
        organizationId,
        contactId,
        supabase
      )
    }
  }

  if (modules.donations && resolvedDonorId) {
    const activeDonorId = resolvedDonorId

    const [{ data: donorRow }, { data: payments }, { data: pledges }] = await Promise.all([
      supabase.from("donor_summary_view").select("*").eq("id", activeDonorId).maybeSingle(),
      supabase
        .from("payments")
        .select(
          "id, amount, refunded_amount, payment_date, source, source_type, status, pledge_id, memo, recurring_donation_plan_id, attributed_group_contact_id, stripe_payment_intent_id, stripe_charge_id, import_batch_id"
        )
        .eq("organization_id", organizationId)
        .eq("donor_id", activeDonorId)
        .order("payment_date", { ascending: false })
        .limit(200),
      supabase
        .from("pledge_status_view")
        .select(
          "id, campaign_name, amount_pledged, amount_paid, balance_remaining, calculated_status, pledge_date, frequency"
        )
        .eq("organization_id", organizationId)
        .eq("donor_id", activeDonorId)
        .order("pledge_date", { ascending: false }),
    ])

    lifetimeContributions = Number(donorRow?.total_donations || 0)

    const attributedGroupIds = [
      ...new Set(
        (payments || [])
          .map((payment) => payment.attributed_group_contact_id as string | null)
          .filter((id): id is string => Boolean(id))
      ),
    ]

    const attributedGroupContacts =
      !isGroup && attributedGroupIds.length > 0
        ? await loadMemberContactsByIds(supabase, organizationId, attributedGroupIds)
        : new Map<string, { full_name: string | null; email: string | null; phone: string | null }>()

    const stripeCardLast4ByIntentId = await loadStripeCardLast4ForPayments(
      supabase,
      organizationId,
      (payments || [])
        .filter((payment) => normalizePaymentSourceChannel(payment.source) === "stripe")
        .map((payment) => payment.stripe_payment_intent_id as string | null)
    )

    const recurringPlanIds = [
      ...new Set(
        (payments || [])
          .map((payment) => payment.recurring_donation_plan_id as string | null)
          .filter((id): id is string => Boolean(id))
      ),
    ]

    const recurringFrequencyByPlanId = new Map<string, string>()
    if (recurringPlanIds.length > 0) {
      const { data: recurringPlans } = await supabase
        .from("recurring_donation_plans")
        .select("id, frequency")
        .eq("organization_id", organizationId)
        .in("id", recurringPlanIds)

      for (const plan of recurringPlans || []) {
        recurringFrequencyByPlanId.set(plan.id as string, plan.frequency as string)
      }
    }

    for (const payment of payments || []) {
      if (!countsTowardGivingTotals(payment)) continue

      const net = paymentNetAmount(payment.amount, payment.refunded_amount)
      donationPaidTotal += net
      activityDates.push(payment.payment_date)

      const description = isGroup
        ? payment.memo?.trim() || "Group Gift"
        : describeDonationPayment({
            recurring_donation_plan_id: payment.recurring_donation_plan_id,
            recurring_frequency: payment.recurring_donation_plan_id
              ? recurringFrequencyByPlanId.get(payment.recurring_donation_plan_id as string) ?? null
              : null,
            memo: payment.memo,
          })

      const attributedGroupContactId =
        (payment.attributed_group_contact_id as string | null) ?? null
      const attributedGroupName = attributedGroupContactId
        ? attributedGroupContacts.get(attributedGroupContactId)?.full_name ?? null
        : null

      timeline.push({
        id: `payment-${payment.id}`,
        date: payment.payment_date,
        eventType: activityTypeLabel("donation"),
        description,
        amount: net,
        method: formatPaymentMethod(payment, stripeCardLast4ByIntentId),
        status: formatFinancialActivityPaymentStatus(payment),
        sourceModule: "donations",
        filterCategory: "donations",
        href: donationPaymentDetailHref(payment.id),
        attributedGroupContactId,
        attributedGroupName,
        paymentActionRow: {
          id: payment.id as string,
          amount: Number(payment.amount || 0),
          refunded_amount: (payment.refunded_amount as number | null) ?? null,
          payment_date: payment.payment_date as string,
          source: (payment.source as string | null) ?? null,
          source_type: (payment.source_type as string | null) ?? null,
          status: (payment.status as string | null) ?? null,
          memo: (payment.memo as string | null) ?? null,
          pledge_id: (payment.pledge_id as string | null) ?? null,
          import_batch_id: (payment.import_batch_id as string | null) ?? null,
          stripe_payment_intent_id: (payment.stripe_payment_intent_id as string | null) ?? null,
          stripe_charge_id: (payment.stripe_charge_id as string | null) ?? null,
        },
      })
    }

    for (const pledge of pledges || []) {
      const balance = Number(pledge.balance_remaining || 0)
      const pledged = Number(pledge.amount_pledged || 0)
      const paid = Number(pledge.amount_paid || 0)
      const status = String(pledge.calculated_status || "")
      const campaign = pledge.campaign_name || "Pledge"
      const pledgeDate = pledge.pledge_date || new Date().toISOString()

      activityDates.push(pledgeDate)

      timeline.push({
        id: `pledge-${pledge.id}`,
        date: pledgeDate,
        eventType: activityTypeLabel("pledge"),
        description: describePledge(campaign),
        amount: pledged,
        method: null,
        status: formatPledgeTimelineStatusLabel(status, pledged, paid),
        sourceModule: "donations",
        filterCategory: "pledges",
        href: donationPledgesHref({ pledgeId: pledge.id, action: "edit" }),
      })

      if (balance > 0 && status.toLowerCase() !== "cancelled") {
        outstandingBalance += balance
        openBalances.push({
          id: pledge.id,
          type: "Pledge",
          description: campaign,
          originalAmount: pledged,
          paidAmount: paid,
          balanceRemaining: balance,
          status: formatPledgeTimelineStatusLabel(status, pledged, paid),
          sourceModule: "donations",
          href: donationPledgesHref({ pledgeId: pledge.id, action: "edit" }),
        })
      }
    }
  }

  if (modules.bookings) {
    const { data: rentals, error: rentalsError } = await supabase
      .from("venue_rentals")
      .select(
        `
        id,
        status,
        created_at,
        venue_rental_event_types ( name )
      `
      )
      .eq("organization_id", organizationId)
      .eq("billing_contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(50)

    if (!rentalsError && (rentals?.length || 0) > 0) {
      rentalsReady = true
      availableFilters.add("venue_rentals")

      const rentalIds = rentals!.map((row) => row.id as string)
      const { data: rentalPayments, error: paymentsError } = await supabase
        .from("rental_payments")
        .select("*")
        .eq("organization_id", organizationId)
        .in("venue_rental_id", rentalIds)
        .order("created_at", { ascending: false })

      if (!paymentsError && rentalPayments) {
        const rentalsById = new Map(
          rentals!.map((rental) => {
            const eventTypeRel = rental.venue_rental_event_types as
              | { name: string }
              | { name: string }[]
              | null
            const eventName = Array.isArray(eventTypeRel)
              ? eventTypeRel[0]?.name
              : eventTypeRel?.name
            return [rental.id as string, { eventName, status: rental.status as string }]
          })
        )

        for (const payment of rentalPayments as RentalPaymentRecord[]) {
          const rentalMeta = rentalsById.get(payment.venue_rental_id)
          const eventLabel = rentalMeta?.eventName || "Venue rental"
          const amount = Number(payment.amount || 0)
          const isPaid = PAID_RENTAL_STATUSES.has(payment.status)
          const eventDate = payment.paid_at || payment.created_at

          if (isPaid && amount > 0) {
            otherPaidTotal += amount
            activityDates.push(eventDate)
            timeline.push({
              id: `rental-payment-${payment.id}`,
              date: eventDate,
              eventType: activityTypeLabel("venue_rentals"),
              description: `${rentalPaymentLabel(payment.payment_type)} — ${eventLabel}`,
              amount,
              method: payment.status.replace(/_/g, " "),
              status: "Succeeded",
              sourceModule: "venue_rentals",
              filterCategory: "venue_rentals",
              href: `/bookings/rentals/${payment.venue_rental_id}`,
            })
          } else if (payment.status === RENTAL_PAYMENT_STATUSES.refunded && amount > 0) {
            activityDates.push(eventDate)
            timeline.push({
              id: `rental-payment-${payment.id}`,
              date: eventDate,
              eventType: activityTypeLabel("venue_rentals"),
              description: `${rentalPaymentLabel(payment.payment_type)} — ${eventLabel}`,
              amount,
              method: payment.status.replace(/_/g, " "),
              status: "Refunded",
              sourceModule: "venue_rentals",
              filterCategory: "venue_rentals",
              href: `/bookings/rentals/${payment.venue_rental_id}`,
            })
          } else if (
            amount > 0 &&
            payment.status !== RENTAL_PAYMENT_STATUSES.refunded
          ) {
            outstandingBalance += amount
            openBalances.push({
              id: payment.id,
              type: rentalPaymentLabel(payment.payment_type),
              description: eventLabel,
              originalAmount: amount,
              paidAmount: 0,
              balanceRemaining: amount,
              status: payment.status.replace(/_/g, " "),
              sourceModule: "venue_rentals",
              href: `/bookings/rentals/${payment.venue_rental_id}`,
            })
          }
        }

        for (const rental of rentals!) {
          const status = rental.status as VenueRentalStatus
          activityDates.push(rental.created_at)
          timeline.push({
            id: `rental-${rental.id}`,
            date: rental.created_at,
            eventType: activityTypeLabel("venue_rentals"),
            description:
              (Array.isArray(rental.venue_rental_event_types)
                ? rental.venue_rental_event_types[0]?.name
                : (rental.venue_rental_event_types as { name: string } | null)?.name) ||
              "Rental Request",
            amount: null,
            method: null,
            status: getVenueRentalStatusLabel(status),
            sourceModule: "venue_rentals",
            filterCategory: "venue_rentals",
            href: `/bookings/rentals/${rental.id}`,
          })
        }
      }
    } else if (isMissingTableError(rentalsError)) {
      rentalsReady = false
    }
  }

  if (modules.programs) {
    const enrollmentQuery = supabase
      .from("program_enrollments")
      .select(
        `
        id,
        status,
        enrollment_date,
        created_at,
        child_name,
        programs:program_id ( name ),
        program_charges:charge_id ( id, total, amount_paid, due_today, paid_at )
      `
      )
      .eq("organization_id", organizationId)
      .or(
        [
          `participant_contact_id.eq.${contactId}`,
          `registrant_contact_id.eq.${contactId}`,
          `payer_contact_id.eq.${contactId}`,
        ].join(",")
      )
      .order("created_at", { ascending: false })
      .limit(50)

    const { data: enrollments, error: enrollmentsError } = await enrollmentQuery

    if (!enrollmentsError) {
      programsReady = true
      if ((enrollments?.length || 0) > 0) {
        availableFilters.add("programs")
      }

      const chargeIds = (enrollments || [])
        .map((enrollment) => {
          const chargeRel = enrollment.program_charges as
            | { id: string }
            | { id: string }[]
            | null
          const charge = Array.isArray(chargeRel) ? chargeRel[0] : chargeRel
          return charge?.id as string | undefined
        })
        .filter((id): id is string => Boolean(id))

      const enrollmentIds = (enrollments || []).map((row) => row.id as string)
      const faByEnrollment = await getActiveFaAwardsByEnrollmentIds(
        organizationId,
        enrollmentIds
      )

      const schedulesByChargeId = new Map<
        string,
        Array<{
          id: string
          amount: number | null
          due_date: string | null
          paid_at: string | null
          status: string | null
          label: string | null
        }>
      >()

      if (chargeIds.length > 0) {
        const { data: scheduleRows } = await supabase
          .from("program_charge_schedule")
          .select("id, charge_id, amount, due_date, paid_at, status, label")
          .eq("organization_id", organizationId)
          .in("charge_id", chargeIds)
          .order("paid_at", { ascending: true })

        for (const row of scheduleRows || []) {
          const chargeId = row.charge_id as string
          if (!schedulesByChargeId.has(chargeId)) {
            schedulesByChargeId.set(chargeId, [])
          }
          schedulesByChargeId.get(chargeId)!.push({
            id: row.id as string,
            amount: row.amount as number | null,
            due_date: row.due_date as string | null,
            paid_at: row.paid_at as string | null,
            status: row.status as string | null,
            label: row.label as string | null,
          })
        }
      }

      for (const enrollment of enrollments || []) {
        const programRel = enrollment.programs as { name: string } | { name: string }[] | null
        const programName = Array.isArray(programRel)
          ? programRel[0]?.name
          : programRel?.name || enrollment.child_name || "Program enrollment"
        const chargeRel = enrollment.program_charges as
          | {
              id: string
              total: number
              amount_paid: number
              due_today: number
              paid_at: string | null
            }
          | {
              id: string
              total: number
              amount_paid: number
              due_today: number
              paid_at: string | null
            }[]
          | null
        const charge = Array.isArray(chargeRel) ? chargeRel[0] : chargeRel
        const enrollmentDate =
          enrollment.enrollment_date || enrollment.created_at || new Date().toISOString()
        const total = charge ? Number(charge.total || 0) : 0
        const paid = charge ? Number(charge.amount_paid || 0) : 0
        // Remaining balance from fee − paid (due_today on charges is often the original due, not remaining).
        const due = Math.max(total - paid, 0)
        const faAward = faByEnrollment.get(enrollment.id as string) || null

        const schedules = charge?.id ? schedulesByChargeId.get(charge.id) || [] : []
        const paidSchedules = schedules.filter(
          (row) =>
            (row.status || "").toLowerCase() === "paid" && Number(row.amount || 0) > 0
        )
        const voidedSchedules = schedules.filter(
          (row) =>
            (row.status || "").toLowerCase() === "void" && Number(row.amount || 0) > 0
        )

        if (faAward) {
          activityDates.push(faAward.appliedAt || enrollmentDate)
          timeline.push({
            id: `program-fa-${enrollment.id}`,
            date: faAward.appliedAt || enrollmentDate,
            eventType: activityTypeLabel("programs"),
            description: `${programName} — Financial assistance (${faAward.planLabel})`,
            amount: -faAward.discountAmount,
            method: null,
            status: "Succeeded",
            sourceModule: "programs",
            filterCategory: "programs",
            href: `/programs/registrations/${enrollment.id}`,
          })
        }

        if (paidSchedules.length > 0) {
          for (const schedule of paidSchedules) {
            const paymentAmount = Number(schedule.amount || 0)
            const paymentDate =
              schedule.paid_at || schedule.due_date || charge?.paid_at || enrollmentDate
            otherPaidTotal += paymentAmount
            activityDates.push(paymentDate)
            timeline.push({
              id: `program-payment-${schedule.id}`,
              date: paymentDate,
              eventType: activityTypeLabel("programs"),
              description: `${programName} — ${schedule.label || "Payment"}`,
              amount: paymentAmount,
              method: null,
              status: "Succeeded",
              sourceModule: "programs",
              filterCategory: "programs",
              href: `/programs/registrations/${enrollment.id}`,
            })
          }
        } else if (paid > 0) {
          otherPaidTotal += paid
          const paymentDate = charge?.paid_at || enrollmentDate
          activityDates.push(paymentDate)
          timeline.push({
            id: `program-payment-${enrollment.id}`,
            date: paymentDate,
            eventType: activityTypeLabel("programs"),
            description: `${programName} — Payment`,
            amount: paid,
            method: null,
            status: "Succeeded",
            sourceModule: "programs",
            filterCategory: "programs",
            href: `/programs/registrations/${enrollment.id}`,
          })
        } else if (enrollmentDate) {
          // Keep last-activity date even when no payment yet (no enrollment row in Transactions).
          activityDates.push(enrollmentDate)
        }

        for (const schedule of voidedSchedules) {
          const paymentAmount = Number(schedule.amount || 0)
          const paymentDate =
            schedule.paid_at || schedule.due_date || enrollmentDate
          activityDates.push(paymentDate)
          timeline.push({
            id: `program-void-${schedule.id}`,
            date: paymentDate,
            eventType: activityTypeLabel("programs"),
            description: `${programName} — Voided ${schedule.label || "payment"}`,
            amount: paymentAmount,
            method: null,
            status: "Voided",
            sourceModule: "programs",
            filterCategory: "programs",
            href: `/programs/registrations/${enrollment.id}`,
          })
        }

        if (due > 0) {
          outstandingBalance += due
          const faDescription = faAward
            ? `${programName} · FA ${faAward.planLabel} (was $${faAward.originalAmount.toFixed(2)})`
            : programName
          openBalances.push({
            id: charge?.id || (enrollment.id as string),
            type: faAward ? "Program fee (FA)" : "Program fee",
            description: faDescription,
            originalAmount: faAward?.originalAmount ?? (total || null),
            paidAmount: paid || null,
            balanceRemaining: due,
            status: enrollment.status,
            sourceModule: "programs",
            href: `/programs/registrations/${enrollment.id}`,
          })
        }
      }
    }

    if (personId) {
      const { data: childEnrollments } = await supabase
        .from("program_enrollments")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("child_person_id", personId)
        .is("participant_contact_id", null)
        .limit(1)

      if ((childEnrollments?.length || 0) > 0) {
        programsReady = true
        availableFilters.add("programs")
      }
    }
  }

  if (modules.membership) {
    availableFilters.add("membership")
  }

  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const totalPaid = donationPaidTotal + otherPaidTotal
  const lastActivityDate = latestDate([
    ...activityDates,
    ...timeline.map((event) => event.date),
  ])

  const filterOrder: ContactFinancialFilter[] = [
    "all",
    "pledges",
    "programs",
    "venue_rentals",
    "membership",
    "other",
  ]

  const payload: ContactFinancialSummaryPayload = {
    metrics: {
      totalPaid,
      lifetimeContributions,
      outstandingBalance,
      lastActivityDate,
      donationsOnlyTotalPaid: otherPaidTotal <= 0,
    },
    openBalances,
    timeline,
    availableFilters: filterOrder.filter(
      (filter) => filter === "all" || availableFilters.has(filter)
    ),
    moduleNotes: {
      programsReady,
      rentalsReady,
      membershipReady,
    },
  }

  if (audience === "customer") {
    payload.timeline = payload.timeline.map((event) => ({
      ...event,
      href: null,
      statusAction: null,
      paymentActionRow: undefined,
    }))
    payload.openBalances = payload.openBalances.map((row) => ({
      ...row,
      href: customerOpenBalanceHref(row),
    }))
  }

  return {
    success: true,
    data: payload,
  }
}

function customerOpenBalanceHref(row: ContactOpenBalanceRow): string | null {
  switch (row.sourceModule) {
    case "donations":
      return "/customer/donation?tab=pledges"
    case "venue_rentals":
      return "/customer/rentals"
    case "programs":
      return "/customer/programs"
    case "membership":
      return "/customer/opportunities"
    default:
      return null
  }
}
