"use server"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  resolveAttendanceMode,
  resolveEventWorkspaceFeatures,
  type EventAttendanceMode,
  type EventWorkspaceFeatures,
} from "@/lib/events/event-workspace-features"
import {
  getEventOperationalPhase,
  getEventOperationalPhaseLabel,
  type EventOperationalPhase,
} from "@/lib/events/event-operational-status"
import { parseServiceRequirements } from "@/lib/events/event-service-requirements"
import type { EventAttendeeListItem } from "@/lib/tickets/ticket-order-queries"
import type { ServiceParticipationWithContact } from "@/lib/service-participations/service-participation-types"
import type { ChildcareRegistration } from "@/lib/child-care/childcare-registration-types"
import {
  ticketOrderNetRevenueCents,
  ticketOrderRefundedCents,
} from "@/lib/tickets/ticket-refund-math"

export type EventOverviewKpi = {
  id: string
  label: string
  value: string
  hint?: string
}

export type EventOverviewAlert = {
  id: string
  severity: "warning" | "info"
  message: string
  hrefTab?: string
}

export type EventOverviewSummary = {
  features: EventWorkspaceFeatures
  attendanceMode: EventAttendanceMode
  operationalPhase: EventOperationalPhase
  operationalPhaseLabel: string
  kpis: EventOverviewKpi[]
  alerts: EventOverviewAlert[]
  registration: {
    modeLabel: string
    registered: number
    capacity: number | null
    remaining: number | null
    salesOpenAt: string | null
    salesCloseAt: string | null
  }
  youth: {
    registered: number
    capacity: number | null
    groups: Array<{ name: string; registered: number; capacity: number | null }>
  }
  staff: {
    paidCount: number
    volunteerCount: number
    taskCount: number
  }
  vendors: {
    count: number
  }
  finance: {
    ticketRevenueCents: number
    donationRevenueCents: number
    expenseCents: number
    refundCents: number
    netCents: number
    currency: string
  }
}

const MODE_LABELS: Record<EventAttendanceMode, string> = {
  paid: "Paid tickets",
  free: "Free registration",
  paid_and_free: "Paid + free registration",
  open_public: "Open to public",
}

export async function getEventOverviewSummary(input: {
  eventId: string
  event: {
    status?: string | null
    start_at?: string | null
    end_at?: string | null
    requires_ticketing?: boolean | null
    requires_volunteers?: boolean | null
    requires_childcare?: boolean | null
    requires_vendors?: boolean | null
    workspace_features?: unknown
    ticketing_config?: {
      attendanceMode?: unknown
      salesOpenAt?: string | null
      salesCloseAt?: string | null
    } | null
    service_requirements?: unknown
  }
  attendees: EventAttendeeListItem[]
  participations: ServiceParticipationWithContact[]
  childcareRegistrations: ChildcareRegistration[]
  linkedCampaignRaisedCents?: number
}): Promise<EventOverviewSummary> {
  const features = resolveEventWorkspaceFeatures(input.event)
  const attendanceMode = resolveAttendanceMode(input.event)
  const config = input.event.ticketing_config || {}
  const service = parseServiceRequirements(input.event.service_requirements)
  const operationalPhase = getEventOperationalPhase({
    status: input.event.status || "draft",
    startAt: input.event.start_at ?? null,
    endAt: input.event.end_at ?? null,
    registrationEnabled: features.registration,
    salesOpenAt: config.salesOpenAt ?? null,
    salesCloseAt: config.salesCloseAt ?? null,
  })
  const operationalPhaseLabel = getEventOperationalPhaseLabel(operationalPhase)

  const activeAttendees = input.attendees.filter(
    (row) => row.status === "valid" || row.status === "checked_in"
  )
  const checkedIn = input.attendees.filter((row) => row.status === "checked_in")
  const registered = activeAttendees.length

  const capacityFromTypes = await getTicketTypeCapacity(input.eventId)
  const youthCapacity =
    (service.childcare?.groups || []).reduce(
      (sum, group) => sum + (group.capacity ?? 0),
      0
    ) ||
    service.childcare?.capacity ||
    null

  const youthRegistered = input.childcareRegistrations.filter(
    (row) => row.status !== "cancelled"
  ).length

  const paidStaff = input.participations.filter(
    (row) =>
      row.participation_type === "staff" && row.status !== "cancelled"
  )
  const volunteers = input.participations.filter(
    (row) =>
      row.participation_type === "volunteer" && row.status !== "cancelled"
  )
  const vendors = input.participations.filter(
    (row) => row.participation_type === "vendor" && row.status !== "cancelled"
  )

  const taskCount = (service.volunteers?.roles || []).filter((role) =>
    role.name.trim()
  ).length

  const finance = await getEventFinanceTotals(
    input.eventId,
    input.linkedCampaignRaisedCents ?? 0
  )

  const kpis: EventOverviewKpi[] = [
    {
      id: "phase",
      label: "Status",
      value: operationalPhaseLabel,
    },
  ]
  if (attendanceMode !== "open_public" || registered > 0) {
    kpis.push({
      id: "attendees",
      label: "Registered",
      value:
        capacityFromTypes != null
          ? `${registered} / ${capacityFromTypes}`
          : String(registered),
      hint: capacityFromTypes != null ? "vs offering capacity" : undefined,
    })
  }
  if (features.registration || finance.ticketRevenueCents > 0) {
    if (finance.ticketRevenueCents > 0 || attendanceMode === "paid" || attendanceMode === "paid_and_free") {
      kpis.push({
        id: "ticket-revenue",
        label: "Ticket revenue",
        value: formatMoney(finance.ticketRevenueCents, finance.currency),
      })
    }
  }
  if (checkedIn.length > 0 || attendanceMode !== "open_public") {
    kpis.push({
      id: "checked-in",
      label: "Checked in",
      value: String(checkedIn.length),
    })
  }
  if (features.youth) {
    kpis.push({
      id: "youth",
      label: "Youth registered",
      value:
        youthCapacity != null
          ? `${youthRegistered} / ${youthCapacity}`
          : String(youthRegistered),
    })
  }
  if (features.staff || paidStaff.length + volunteers.length > 0) {
    kpis.push({
      id: "staff",
      label: "Staff / Volunteers",
      value: `${paidStaff.length} / ${volunteers.length}`,
      hint: "Paid / volunteers",
    })
  }
  if (features.vendors || vendors.length > 0) {
    kpis.push({
      id: "vendors",
      label: "Vendors",
      value: String(vendors.length),
    })
  }
  if (features.finance || finance.expenseCents > 0 || finance.ticketRevenueCents > 0) {
    if (finance.donationRevenueCents > 0) {
      kpis.push({
        id: "donations",
        label: "Campaign gifts",
        value: formatMoney(finance.donationRevenueCents, finance.currency),
        hint: "Linked donations campaign",
      })
    }
    kpis.push({
      id: "net",
      label: "Event net",
      value: formatMoney(finance.netCents, finance.currency),
      hint: "Tickets + gifts − refunds − expenses",
    })
  }

  const alerts: EventOverviewAlert[] = []
  const incomplete = input.attendees.filter(
    (row) =>
      (row.status === "valid" || row.status === "checked_in") &&
      (!row.attendeeName || !row.purchaserEmail)
  )
  if (incomplete.length > 0) {
    alerts.push({
      id: "incomplete-attendees",
      severity: "warning",
      message: `${incomplete.length} attendee${incomplete.length === 1 ? "" : "s"} missing name or email`,
      hrefTab: "attendees",
    })
  }

  if (features.staff && taskCount > 0 && paidStaff.length + volunteers.length === 0) {
    alerts.push({
      id: "unfilled-staff",
      severity: "warning",
      message: `${taskCount} task${taskCount === 1 ? "" : "s"} configured with no assignments yet`,
      hrefTab: "staff",
    })
  }

  if (features.youth && youthCapacity != null && youthRegistered >= youthCapacity) {
    alerts.push({
      id: "youth-full",
      severity: "info",
      message: "Youth offerings are at capacity",
      hrefTab: "youth",
    })
  }

  if (features.vendors && vendors.length === 0) {
    alerts.push({
      id: "no-vendors",
      severity: "info",
      message: "Vendors enabled but none assigned yet",
      hrefTab: "vendors",
    })
  }

  const waitlisted = input.attendees.filter((row) => row.status === "waitlisted")
  if (waitlisted.length > 0) {
    alerts.push({
      id: "waitlist",
      severity: "info",
      message: `${waitlisted.length} on waitlist — promote when capacity opens`,
      hrefTab: "attendees",
    })
  }

  const remaining =
    capacityFromTypes != null
      ? Math.max(0, capacityFromTypes - registered)
      : null

  return {
    features,
    attendanceMode,
    operationalPhase,
    operationalPhaseLabel,
    kpis,
    alerts,
    registration: {
      modeLabel: MODE_LABELS[attendanceMode],
      registered,
      capacity: capacityFromTypes,
      remaining,
      salesOpenAt: config.salesOpenAt ?? null,
      salesCloseAt: config.salesCloseAt ?? null,
    },
    youth: {
      registered: youthRegistered,
      capacity: youthCapacity,
      groups: (service.childcare?.groups || []).map((group) => ({
        name:
          group.offering === "field_trip"
            ? group.venueName || "Field trip"
            : "Childcare",
        registered: 0,
        capacity: group.capacity ?? null,
      })),
    },
    staff: {
      paidCount: paidStaff.length,
      volunteerCount: volunteers.length,
      taskCount,
    },
    vendors: { count: vendors.length },
    finance,
  }
}

async function getTicketTypeCapacity(eventId: string): Promise<number | null> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return null

  const { data, error } = await supabase
    .from("event_ticket_types")
    .select("quantity_total")
    .eq("organization_id", organizationId)
    .eq("internal_event_id", eventId)
    .eq("is_active", true)

  if (error || !data?.length) return null
  const totals = data
    .map((row) => row.quantity_total as number | null)
    .filter((value): value is number => value != null)
  if (totals.length === 0) return null
  return totals.reduce((sum, value) => sum + value, 0)
}

async function getEventFinanceTotals(
  eventId: string,
  linkedCampaignRaisedCents = 0
) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  const empty = {
    ticketRevenueCents: 0,
    donationRevenueCents: 0,
    expenseCents: 0,
    refundCents: 0,
    netCents: 0,
    currency: "USD",
  }
  if (!organizationId) return empty

  const [ordersResult, expensesResult] = await Promise.all([
    supabase
      .from("ticket_orders")
      .select("total_cents, refunded_amount_cents, currency, status")
      .eq("organization_id", organizationId)
      .eq("internal_event_id", eventId),
    supabase
      .from("event_expenses")
      .select("amount_cents, currency")
      .eq("organization_id", organizationId)
      .eq("internal_event_id", eventId),
  ])

  const orders =
    ordersResult.error?.code === "42703"
      ? (
          await supabase
            .from("ticket_orders")
            .select("total_cents, currency, status")
            .eq("organization_id", organizationId)
            .eq("internal_event_id", eventId)
        ).data || []
      : ordersResult.data || []

  let ticketRevenueCents = 0
  let refundCents = 0
  let currency = "USD"
  for (const row of orders) {
    currency = (row.currency as string) || currency
    const money = {
      status: row.status as string,
      totalCents: (row.total_cents as number) || 0,
      refundedAmountCents: Number(
        (row as { refunded_amount_cents?: number }).refunded_amount_cents || 0
      ),
    }
    ticketRevenueCents += ticketOrderNetRevenueCents(money)
    refundCents += ticketOrderRefundedCents(money)
  }

  let expenseCents = 0
  if (!expensesResult.error) {
    for (const row of expensesResult.data || []) {
      expenseCents += (row.amount_cents as number) || 0
      currency = (row.currency as string) || currency
    }
  }

  return {
    ticketRevenueCents,
    donationRevenueCents: linkedCampaignRaisedCents,
    expenseCents,
    refundCents,
    netCents:
      ticketRevenueCents +
      linkedCampaignRaisedCents -
      expenseCents,
    currency,
  }
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100)
}
