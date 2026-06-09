import type { SupabaseClient } from "@supabase/supabase-js"
import {
  type ContactActivityRecord,
  type ContactActivitySummary,
  emptyActivitySummary,
} from "@/lib/contacts/contact-activities"
import type { ContactRoleValue } from "@/lib/contacts/contact-constants"
import { ROLE_VALUE_TO_LABEL } from "@/lib/contacts/contact-constants"
import { getVenueRentalStatusLabel } from "@/lib/bookings/venue-rental-status"
import type { VenueRentalStatus } from "@/lib/bookings/venue-rental-types"

export type ContactRelationshipSummary = {
  affiliationsCount: number
  teamsCount: number
  programsCount: number
  ticketsCount: number
  bookingsCount: number
  donationsTotal: number
  donationsCount: number
  vendorActivityCount: number
  lastActivityDate: string | null
}

export type ContactTimelineItem = {
  id: string
  date: string
  title: string
  module: string
  subtitle?: string
  amount?: number | null
  status?: string | null
}

export type ContactDonorStats = {
  totalDonated: number
  donationCount: number
  lastDonationDate: string | null
  pledgeCount: number
}

export type ContactDonationRecord = {
  id: string
  date: string
  amount: number
  memo: string | null
  status: string | null
}

export type ContactRentalRecord = {
  id: string
  date: string
  status: string
  statusLabel: string
  eventTypeName: string | null
  spacesSummary: string | null
}

export type ContactRentalStats = {
  rentalCount: number
  lastRentalDate: string | null
}

export type ContactNoteRecord = {
  id: string
  note: string
  created_at: string
  author_id?: string | null
  note_type?: string | null
}

export type ContactEnrollmentRecord = {
  id: string
  programName: string
  status: string | null
  enrollmentDate: string | null
}

export type ContactProfileData = {
  summary: ContactRelationshipSummary
  activity: ContactActivitySummary
  timeline: ContactTimelineItem[]
  donorStats: ContactDonorStats
  donationRecords: ContactDonationRecord[]
  rentalStats: ContactRentalStats
  rentalRecords: ContactRentalRecord[]
  enrollmentRecords: ContactEnrollmentRecord[]
  activeTeamsCount: number
  notes: ContactNoteRecord[]
}

export type FetchContactProfileInput = {
  contactId: string
  personId?: string | null
  email?: string | null
  roles: ContactRoleValue[]
  contactCreatedAt?: string | null
}

function parseDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function latestDate(dates: (string | null | undefined)[]) {
  const parsed = dates
    .map(parseDate)
    .filter(Boolean) as string[]
  if (parsed.length === 0) return null
  return parsed.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
}

function isPaymentDonation(record: ContactActivityRecord) {
  return (
    record.module === "donations" &&
    (record.activityType === "donation_made" || !record.activityType.includes("pledge"))
  )
}

export async function fetchContactProfileData(
  supabase: SupabaseClient,
  orgId: string,
  input: FetchContactProfileInput
): Promise<ContactProfileData> {
  const { contactId, personId, email, roles, contactCreatedAt } = input
  const activity = emptyActivitySummary()
  const timeline: ContactTimelineItem[] = []
  const donationRecords: ContactDonationRecord[] = []
  const rentalRecords: ContactRentalRecord[] = []
  const enrollmentRecords: ContactEnrollmentRecord[] = []
  let activeTeamsCount = 0
  const notes: ContactNoteRecord[] = []

  if (contactCreatedAt) {
    timeline.push({
      id: `contact-created-${contactId}`,
      date: contactCreatedAt,
      title: "Contact created",
      module: "Contacts",
    })
  }

  const { data: roleRows } = await supabase
    .from("contact_roles")
    .select("id, role, created_at")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)

  for (const roleRow of roleRows || []) {
    const roleLabel =
      ROLE_VALUE_TO_LABEL[roleRow.role as ContactRoleValue] ||
      roleRow.role.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
    timeline.push({
      id: `role-${roleRow.id}`,
      date: roleRow.created_at || contactCreatedAt || new Date().toISOString(),
      title: `${roleLabel} affiliation added`,
      module: "Affiliations",
    })
  }

  const { data: teamMemberships } = await supabase
    .from("hr_team_memberships")
    .select(`
      id,
      status,
      start_date,
      created_at,
      hr_teams:team_id (name),
      hr_team_positions:team_position_id (name)
    `)
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .is("deleted_at", null)

  for (const row of teamMemberships || []) {
    if (row.status === "active") activeTeamsCount += 1
    const teamName = (row as any).hr_teams?.name || "Team"
    const positionName = (row as any).hr_team_positions?.name
    timeline.push({
      id: `team-${row.id}`,
      date: row.start_date || row.created_at,
      title: `Assigned to ${teamName}`,
      module: "Teams",
      subtitle: positionName ? `Position: ${positionName}` : undefined,
      status: row.status,
    })
  }

  const { data: ledgerRows } = await supabase
    .from("contact_activities")
    .select("id, module, activity_type, title, subtitle, activity_date, amount, status, created_at")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .order("activity_date", { ascending: false })
    .limit(100)

  if (ledgerRows?.length) {
    for (const row of ledgerRows) {
      const record: ContactActivityRecord = {
        id: row.id,
        module: row.module as ContactActivityRecord["module"],
        activityType: row.activity_type,
        title: row.title,
        subtitle: row.subtitle || undefined,
        date: row.activity_date || row.created_at,
        amount: row.amount != null ? Number(row.amount) : null,
        status: row.status,
      }
      if (row.module === "programs") activity.programs.push(record)
      else if (row.module === "ticketing") activity.ticketing.push(record)
      else if (row.module === "spaces") activity.spaces.push(record)
      else if (row.module === "donations") activity.donations.push(record)
      else if (row.module === "vendorHub") activity.vendorHub.push(record)

      timeline.push({
        id: `ledger-${row.id}`,
        date: row.activity_date || row.created_at,
        title: row.title,
        module: formatModuleLabel(row.module),
        subtitle: row.subtitle || undefined,
        amount: row.amount != null ? Number(row.amount) : null,
        status: row.status,
      })
    }
  }

  const { data: payments } = await supabase
    .from("payments")
    .select("id, amount, payment_date, source, status, memo")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .order("payment_date", { ascending: false })
    .limit(50)

  for (const payment of payments || []) {
    const record: ContactActivityRecord = {
      id: payment.id,
      module: "donations",
      activityType: "donation_made",
      title: payment.memo || "Donation",
      subtitle: payment.source || undefined,
      date: payment.payment_date,
      amount: Number(payment.amount) || 0,
      status: payment.status,
    }
    activity.donations.push(record)
    donationRecords.push({
      id: payment.id,
      date: payment.payment_date,
      amount: Number(payment.amount) || 0,
      memo: payment.memo,
      status: payment.status,
    })
    timeline.push({
      id: `payment-${payment.id}`,
      date: payment.payment_date,
      title: payment.memo || "Donation made",
      module: "Donations",
      amount: Number(payment.amount) || 0,
      status: payment.status,
    })
  }

  const { data: pledges } = await supabase
    .from("donation_pledges")
    .select("id, amount, start_date, status, fund_name, created_at")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .order("start_date", { ascending: false })
    .limit(20)

  for (const pledge of pledges || []) {
    activity.donations.push({
      id: pledge.id,
      module: "donations",
      activityType: "pledge_created",
      title: pledge.fund_name || "Pledge",
      date: pledge.start_date || pledge.created_at,
      amount: Number(pledge.amount) || 0,
      status: pledge.status,
    })
    timeline.push({
      id: `pledge-${pledge.id}`,
      date: pledge.start_date || pledge.created_at,
      title: pledge.fund_name ? `Pledge: ${pledge.fund_name}` : "Pledge created",
      module: "Donations",
      amount: Number(pledge.amount) || 0,
      status: pledge.status,
    })
  }

  async function appendEnrollmentActivity(
    enrollments: Array<{
      id: string
      enrollment_date: string | null
      status: string | null
      payment_status: string | null
      created_at: string | null
      programs?: { name?: string } | null
    }>
  ) {
    for (const enrollment of enrollments) {
      const programName = enrollment.programs?.name || "Program"
      enrollmentRecords.push({
        id: enrollment.id,
        programName,
        status: enrollment.status || enrollment.payment_status,
        enrollmentDate: enrollment.enrollment_date || enrollment.created_at,
      })
      activity.programs.push({
        id: enrollment.id,
        module: "programs",
        activityType: "registered_program",
        title: programName,
        date: enrollment.enrollment_date || enrollment.created_at,
        status: enrollment.status || enrollment.payment_status,
      })
      timeline.push({
        id: `enrollment-${enrollment.id}`,
        date: enrollment.enrollment_date || enrollment.created_at || new Date().toISOString(),
        title: `Registered for ${programName}`,
        module: "Programs",
        status: enrollment.status || enrollment.payment_status,
      })
    }
  }

  const enrollmentSelect = `
    id,
    enrollment_date,
    status,
    payment_status,
    created_at,
    programs:program_id (name)
  `

  const { data: enrollmentsByContact } = await supabase
    .from("program_enrollments")
    .select(enrollmentSelect)
    .eq("organization_id", orgId)
    .eq("participant_contact_id", contactId)
    .order("enrollment_date", { ascending: false })
    .limit(50)

  await appendEnrollmentActivity((enrollmentsByContact || []) as any[])

  if (personId) {
    const { data: enrollmentsByPerson } = await supabase
      .from("program_enrollments")
      .select(enrollmentSelect)
      .eq("organization_id", orgId)
      .eq("child_person_id", personId)
      .is("participant_contact_id", null)
      .order("enrollment_date", { ascending: false })
      .limit(50)

    await appendEnrollmentActivity((enrollmentsByPerson || []) as any[])
  }

  if (email) {
    const { data: bookings } = await supabase
      .from("venue_bookings")
      .select("id, event_name, event_date, status, total_amount, created_at")
      .eq("organization_id", orgId)
      .ilike("contact_email", email)
      .order("event_date", { ascending: false })
      .limit(30)

    for (const booking of bookings || []) {
      activity.spaces.push({
        id: booking.id,
        module: "spaces",
        activityType: "booked_venue",
        title: booking.event_name || "Venue booking",
        date: booking.event_date || booking.created_at,
        amount: booking.total_amount != null ? Number(booking.total_amount) : null,
        status: booking.status,
      })
      timeline.push({
        id: `booking-${booking.id}`,
        date: booking.event_date || booking.created_at,
        title: booking.event_name ? `Booked ${booking.event_name}` : "Venue booked",
        module: "Spaces",
        amount: booking.total_amount != null ? Number(booking.total_amount) : null,
        status: booking.status,
      })
    }
  }

  const { data: venueRentals, error: venueRentalsError } = await supabase
    .from("venue_rentals")
    .select(`
      id,
      status,
      created_at,
      venue_rental_event_types(name),
      rental_reservations(start_at, venues(name))
    `)
    .eq("organization_id", orgId)
    .eq("billing_contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(50)

  if (!venueRentalsError && venueRentals?.length) {
    for (const rental of venueRentals) {
      const status = rental.status as VenueRentalStatus
      const eventTypeRel = rental.venue_rental_event_types as
        | { name: string }
        | { name: string }[]
        | null
      const eventTypeName = Array.isArray(eventTypeRel)
        ? eventTypeRel[0]?.name
        : eventTypeRel?.name

      const reservations = (rental.rental_reservations || []) as Array<{
        start_at: string
        venues?: { name: string } | { name: string }[] | null
      }>
      const spaceNames = reservations
        .map((row) => {
          const venueRel = row.venues
          if (Array.isArray(venueRel)) return venueRel[0]?.name
          return venueRel?.name
        })
        .filter(Boolean) as string[]
      const primaryDate = reservations[0]?.start_at || rental.created_at

      rentalRecords.push({
        id: rental.id,
        date: primaryDate || rental.created_at,
        status: rental.status,
        statusLabel: getVenueRentalStatusLabel(status),
        eventTypeName: eventTypeName ?? null,
        spacesSummary: spaceNames.length ? spaceNames.join(", ") : null,
      })

      activity.spaces.push({
        id: rental.id,
        module: "spaces",
        activityType: "venue_rental",
        title: eventTypeName ? `Venue rental: ${eventTypeName}` : "Venue rental",
        subtitle: spaceNames.length ? spaceNames.join(", ") : undefined,
        date: primaryDate || rental.created_at,
        status: rental.status,
      })

      timeline.push({
        id: `venue-rental-${rental.id}`,
        date: primaryDate || rental.created_at,
        title: eventTypeName ? `Venue rental: ${eventTypeName}` : "Venue rental",
        module: "Rentals",
        subtitle: spaceNames.length ? spaceNames.join(", ") : undefined,
        status: getVenueRentalStatusLabel(status),
      })
    }
  }

  const { data: vendors } = await supabase
    .from("vendors")
    .select("id, business_name, status, created_at")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId)
    .limit(20)

  for (const vendor of vendors || []) {
    activity.vendorHub.push({
      id: vendor.id,
      module: "vendorHub",
      activityType: "vendor_application",
      title: vendor.business_name || "Vendor record",
      date: vendor.created_at,
      status: vendor.status,
    })
    timeline.push({
      id: `vendor-${vendor.id}`,
      date: vendor.created_at,
      title: vendor.business_name
        ? `Vendor application: ${vendor.business_name}`
        : "Vendor application submitted",
      module: "Vendor Hub",
      status: vendor.status,
    })
  }

  const notesSelect = await supabase
    .from("contact_notes")
    .select("id, note, created_at, author_id, note_type")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })

  if (!notesSelect.error) {
    for (const note of notesSelect.data || []) {
      notes.push({
        id: note.id,
        note: note.note,
        created_at: note.created_at,
        author_id: (note as any).author_id ?? null,
        note_type: (note as any).note_type ?? null,
      })
      timeline.push({
        id: `note-${note.id}`,
        date: note.created_at,
        title: "Note added",
        module: "Notes",
        subtitle: note.note.length > 80 ? `${note.note.slice(0, 80)}…` : note.note,
      })
    }
  }

  activity.hasTransactionalActivity =
    activity.programs.length +
      activity.ticketing.length +
      activity.spaces.length +
      activity.donations.filter(isPaymentDonation).length +
      activity.vendorHub.length >
    0

  const paymentRecords = activity.donations.filter(isPaymentDonation)
  const donorStats: ContactDonorStats = {
    totalDonated: paymentRecords.reduce((sum, row) => sum + (row.amount || 0), 0),
    donationCount: paymentRecords.length,
    lastDonationDate: paymentRecords[0]?.date || null,
    pledgeCount: pledges?.length || 0,
  }

  const rentalStats: ContactRentalStats = {
    rentalCount: rentalRecords.length,
    lastRentalDate: rentalRecords[0]?.date || null,
  }

  const allDates = timeline.map((item) => item.date)
  const relationshipSummary: ContactRelationshipSummary = {
    affiliationsCount: roles.length,
    teamsCount: activeTeamsCount,
    programsCount: activity.programs.length,
    ticketsCount: activity.ticketing.length,
    bookingsCount: activity.spaces.length,
    donationsTotal: donorStats.totalDonated,
    donationsCount: donorStats.donationCount,
    vendorActivityCount: activity.vendorHub.length,
    lastActivityDate: latestDate(allDates),
  }

  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const uniqueEnrollmentRecords = Array.from(
    new Map(enrollmentRecords.map((record) => [record.id, record])).values()
  )

  return {
    summary: relationshipSummary,
    activity,
    timeline,
    donorStats,
    donationRecords,
    rentalStats,
    rentalRecords,
    enrollmentRecords: uniqueEnrollmentRecords,
    activeTeamsCount,
    notes,
  }
}

function formatModuleLabel(module: string) {
  switch (module) {
    case "programs":
      return "Programs"
    case "ticketing":
      return "Ticketing"
    case "spaces":
      return "Spaces"
    case "donations":
      return "Donations"
    case "vendorHub":
      return "Vendor Hub"
    default:
      return module.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  }
}

export function formatContactDate(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function formatContactMoney(value?: number | null) {
  if (value == null) return "$0"
  return Number(value).toLocaleString(undefined, { style: "currency", currency: "USD" })
}
