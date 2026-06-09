/**
 * Legacy venue_bookings read queries for staff dashboard pages.
 * Customer pages also read venue_bookings until Phase B wires the venue_rentals flow.
 * Do not use for new customer Venue Rental submissions — use venue-rental-actions.ts instead.
 */

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

import {
  formatVenueBookingDate,
  formatVenueBookingDateTime,
  formatVenueBookingPaymentStatus,
  formatVenueBookingStatus,
  formatVenueBookingTime,
  shortVenueBookingId,
} from "./venue-booking-format"
import type {
  VenueBookingDashboardRow,
  VenueBookingDashboardStats,
} from "./venue-booking-types"

type VenueBookingQueryRow = {
  id: string
  event_type: string | null
  event_date: string | null
  start_time: string | null
  end_time: string | null
  guest_count: number | null
  status: string | null
  total_amount: number | null
  balance_due: number | null
  notes: string | null
  created_at: string
  user_id: string | null
  venues: { id: string; name: string } | null
  profiles: { full_name: string | null; email: string | null } | null
}

function mapVenueBookingRow(row: VenueBookingQueryRow): VenueBookingDashboardRow {
  const { status, label: statusLabel } = formatVenueBookingStatus(row.status)
  const startTime = formatVenueBookingTime(row.start_time)
  const endTime = formatVenueBookingTime(row.end_time)

  return {
    id: row.id,
    shortId: shortVenueBookingId(row.id),
    customer: {
      name: row.profiles?.full_name?.trim() || "Customer",
      email: row.profiles?.email || null,
    },
    venueName: row.venues?.name || "Unassigned venue",
    eventType: row.event_type?.trim() || "Venue Rental",
    eventDate: row.event_date || "",
    eventDateLabel: formatVenueBookingDate(row.event_date),
    startTime,
    endTime,
    timeLabel: `${startTime} – ${endTime}`,
    expectedGuests: Number(row.guest_count || 0),
    submittedAt: row.created_at,
    submittedAtLabel: formatVenueBookingDateTime(row.created_at),
    status,
    statusLabel,
    paymentStatus: formatVenueBookingPaymentStatus(row),
    estimatedTotal: Number(row.total_amount || 0),
    notes: row.notes,
  }
}

export async function getVenueBookingDashboardRows(): Promise<VenueBookingDashboardRow[]> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return []
  }

  const { data, error } = await supabase
    .from("venue_bookings")
    .select(
      `
      id,
      event_type,
      event_date,
      start_time,
      end_time,
      guest_count,
      status,
      total_amount,
      balance_due,
      notes,
      created_at,
      user_id,
      venues:venue_id ( id, name )
    `
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })

  if (error) {
    if (error.code === "42P01") {
      return []
    }
    console.error(error)
    throw new Error("Failed to load venue bookings")
  }

  const rows = (data || []) as Omit<VenueBookingQueryRow, "profiles">[]
  const userIds = Array.from(
    new Set(rows.map((row) => row.user_id).filter(Boolean))
  ) as string[]

  const profileMap = new Map<string, { full_name: string | null; email: string | null }>()

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds)

    for (const profile of profiles || []) {
      profileMap.set(profile.id, {
        full_name: profile.full_name,
        email: profile.email,
      })
    }
  }

  return rows.map((row) =>
    mapVenueBookingRow({
      ...row,
      profiles: row.user_id ? profileMap.get(row.user_id) || null : null,
    })
  )
}

export function getVenueBookingDashboardStats(
  rows: VenueBookingDashboardRow[]
): VenueBookingDashboardStats {
  return {
    pendingCount: rows.filter((row) => row.status === "pending_review").length,
    approvedCount: rows.filter((row) =>
      ["approved", "confirmed"].includes(row.status)
    ).length,
    overdueCount: rows.filter((row) => row.paymentStatus === "Overdue").length,
    pendingRevenue: rows
      .filter((row) => row.status === "pending_review")
      .reduce((sum, row) => sum + row.estimatedTotal, 0),
  }
}
