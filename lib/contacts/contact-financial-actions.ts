"use server"

import { formatPledgeStatusLabel } from "@/lib/donations/donation-status"
import { donationPaymentDetailHref } from "@/lib/donations/donation-payment-paths"
import {
  countsTowardGivingTotals,
  paymentNetAmount,
} from "@/lib/donations/payment-net-amount"
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
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
import { hasPermission } from "@/lib/permissions/permissions"
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

function formatPaymentMethod(source: string | null | undefined) {
  if (!source) return null
  return source.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

const MODULE_TYPE_LABELS = {
  donations: "Donations",
  programs: "Programs",
  venue_rentals: "Venue Rental",
  membership: "Membership",
  other: "Other",
} as const

function moduleTypeLabel(module: keyof typeof MODULE_TYPE_LABELS) {
  return MODULE_TYPE_LABELS[module]
}

function describeDonationPayment(payment: {
  pledge_id?: string | null
  recurring_donation_plan_id?: string | null
  memo?: string | null
}) {
  if (payment.pledge_id) return "Pledge Payment"
  const memo = String(payment.memo || "")
  if (payment.recurring_donation_plan_id || memo.includes("|recurring|")) {
    return "Recurring Donation"
  }
  return "One-Time Donation"
}

function formatPledgeFrequencyLabel(frequency: string | null | undefined) {
  if (!frequency) return null
  const normalized = frequency.trim().toLowerCase().replace(/_/g, "-")
  if (normalized === "one-time" || normalized === "one time") return "One-Time"
  if (normalized === "monthly") return "Monthly"
  if (normalized === "quarterly") return "Quarterly"
  if (normalized === "yearly" || normalized === "annual") return "Yearly"
  return frequency.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

function describePledge(campaignName: string, frequency: string | null | undefined) {
  const campaign = campaignName.trim()
  if (campaign && campaign.toLowerCase() !== "pledge") return campaign
  const frequencyLabel = formatPledgeFrequencyLabel(frequency)
  return frequencyLabel ? `${frequencyLabel} Pledge` : "Pledge"
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

  if (modules.donations && donorId && !isGroup) {
    availableFilters.add("donations")
    availableFilters.add("pledges")

    const [{ data: donorRow }, { data: payments }, { data: pledges }] = await Promise.all([
      supabase.from("donor_summary_view").select("*").eq("id", donorId).maybeSingle(),
      supabase
        .from("payments")
        .select(
          "id, amount, refunded_amount, payment_date, source, source_type, status, pledge_id, memo, recurring_donation_plan_id"
        )
        .eq("organization_id", organizationId)
        .eq("donor_id", donorId)
        .order("payment_date", { ascending: false })
        .limit(200),
      supabase
        .from("pledge_status_view")
        .select(
          "id, campaign_name, amount_pledged, amount_paid, balance_remaining, calculated_status, pledge_date, frequency"
        )
        .eq("organization_id", organizationId)
        .eq("donor_id", donorId)
        .order("pledge_date", { ascending: false }),
    ])

    lifetimeContributions = Number(donorRow?.total_donations || 0)

    for (const payment of payments || []) {
      if (!countsTowardGivingTotals(payment)) continue

      const net = paymentNetAmount(payment.amount, payment.refunded_amount)
      donationPaidTotal += net
      activityDates.push(payment.payment_date)

      const isPledgePayment = Boolean(payment.pledge_id)
      timeline.push({
        id: `payment-${payment.id}`,
        date: payment.payment_date,
        eventType: moduleTypeLabel("donations"),
        description: describeDonationPayment(payment),
        amount: net,
        method: formatPaymentMethod(payment.source),
        status: payment.status,
        sourceModule: "donations",
        filterCategory: isPledgePayment ? "pledges" : "donations",
        href: donationPaymentDetailHref(payment.id),
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
        eventType: moduleTypeLabel("donations"),
        description: describePledge(campaign, pledge.frequency as string | null),
        amount: pledged,
        method: formatPledgeFrequencyLabel(pledge.frequency as string | null),
        status: formatPledgeStatusLabel(status),
        sourceModule: "donations",
        filterCategory: "pledges",
        href: null,
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
          status: formatPledgeStatusLabel(status),
          sourceModule: "donations",
          href: null,
        })
      }
    }
  } else if (modules.donations && donorId && isGroup) {
    availableFilters.add("donations")

    const { data: payments } = await supabase
      .from("payments")
      .select(
        "id, amount, refunded_amount, payment_date, source, source_type, status, memo"
      )
      .eq("organization_id", organizationId)
      .eq("donor_id", donorId)
      .order("payment_date", { ascending: false })
      .limit(200)

    for (const payment of payments || []) {
      if (!countsTowardGivingTotals(payment)) continue
      const net = paymentNetAmount(payment.amount, payment.refunded_amount)
      donationPaidTotal += net
      lifetimeContributions += net
      activityDates.push(payment.payment_date)
      timeline.push({
        id: `payment-${payment.id}`,
        date: payment.payment_date,
        eventType: moduleTypeLabel("donations"),
        description: payment.memo?.trim() || "Group Gift",
        amount: net,
        method: formatPaymentMethod(payment.source),
        status: payment.status,
        sourceModule: "donations",
        filterCategory: "donations",
        href: donationPaymentDetailHref(payment.id),
      })
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
              eventType: moduleTypeLabel("venue_rentals"),
              description: `${rentalPaymentLabel(payment.payment_type)} — ${eventLabel}`,
              amount,
              method: payment.status.replace(/_/g, " "),
              status: "Paid",
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
            eventType: moduleTypeLabel("venue_rentals"),
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
    let enrollmentQuery = supabase
      .from("program_enrollments")
      .select(
        `
        id,
        status,
        enrollment_date,
        created_at,
        child_name,
        programs:program_id ( name ),
        program_charges:charge_id ( id, total, amount_paid, due_today )
      `
      )
      .eq("organization_id", organizationId)
      .eq("participant_contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(50)

    const { data: enrollments, error: enrollmentsError } = await enrollmentQuery

    if (!enrollmentsError) {
      programsReady = true
      if ((enrollments?.length || 0) > 0) {
        availableFilters.add("programs")
      }

      for (const enrollment of enrollments || []) {
        const programRel = enrollment.programs as { name: string } | { name: string }[] | null
        const programName = Array.isArray(programRel)
          ? programRel[0]?.name
          : programRel?.name || enrollment.child_name || "Program enrollment"
        const chargeRel = enrollment.program_charges as
          | { id: string; total: number; amount_paid: number; due_today: number }
          | { id: string; total: number; amount_paid: number; due_today: number }[]
          | null
        const charge = Array.isArray(chargeRel) ? chargeRel[0] : chargeRel
        const eventDate =
          enrollment.enrollment_date || enrollment.created_at || new Date().toISOString()
        const total = charge ? Number(charge.total || 0) : 0
        const paid = charge ? Number(charge.amount_paid || 0) : 0
        const due = charge
          ? Math.max(Number(charge.due_today ?? total - paid), 0)
          : 0

        activityDates.push(eventDate)

        if (total > 0) {
          timeline.push({
            id: `program-charge-${enrollment.id}`,
            date: eventDate,
            eventType: moduleTypeLabel("programs"),
            description: programName,
            amount: total,
            method: null,
            status: enrollment.status,
            sourceModule: "programs",
            filterCategory: "programs",
            href: `/programs/registrations/${enrollment.id}`,
          })
        } else {
          timeline.push({
            id: `program-enrollment-${enrollment.id}`,
            date: eventDate,
            eventType: moduleTypeLabel("programs"),
            description: programName,
            amount: null,
            method: null,
            status: enrollment.status,
            sourceModule: "programs",
            filterCategory: "programs",
            href: `/programs/registrations/${enrollment.id}`,
          })
        }

        if (paid > 0) {
          otherPaidTotal += paid
          timeline.push({
            id: `program-payment-${enrollment.id}`,
            date: eventDate,
            eventType: moduleTypeLabel("programs"),
            description: `${programName} — Payment`,
            amount: paid,
            method: null,
            status: enrollment.status,
            sourceModule: "programs",
            filterCategory: "programs",
            href: `/programs/registrations/${enrollment.id}`,
          })
        }

        if (due > 0) {
          outstandingBalance += due
          openBalances.push({
            id: charge?.id || (enrollment.id as string),
            type: "Program fee",
            description: programName,
            originalAmount: total || null,
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
    "donations",
    "pledges",
    "programs",
    "venue_rentals",
    "membership",
    "other",
  ]

  return {
    success: true,
    data: {
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
    },
  }
}
