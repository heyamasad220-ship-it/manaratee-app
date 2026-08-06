import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { formatContactDisplayName } from "@/lib/vendor-hub/contact-centric-model"
import { getVendorHubEvents } from "@/lib/vendor-hub/vendor-hub-event-queries"

export type VendorHubReportEventOption = {
  id: string
  name: string
  eventDate: string | null
}

export type VendorHubReportOverview = {
  totalRevenue: number
  totalVendors: number
  foodVendors: number
  expectedAttendance: number
  revenueByCategory: Array<{
    category: string
    vendors: number
    revenue: number
  }>
  topVendors: Array<{
    vendorName: string
    category: string
    feesPaid: number
  }>
}

export type VendorHubVendorSalesRow = {
  vendorName: string
  category: string
  boothType: string
  status: string
  boothFee: number
  paid: number
}

export type VendorHubBoothPerformanceRow = {
  boothType: string
  total: number
  allocated: number
  available: number
  utilizationPercent: number
  revenue: number
}

export type VendorHubReportsPayload = {
  events: VendorHubReportEventOption[]
  overview: VendorHubReportOverview
  vendorSales: VendorHubVendorSalesRow[]
  boothPerformance: VendorHubBoothPerformanceRow[]
}

function formatMoneyNumber(value: number) {
  return Number.isFinite(value) ? value : 0
}

function emptyOverview(): VendorHubReportOverview {
  return {
    totalRevenue: 0,
    totalVendors: 0,
    foodVendors: 0,
    expectedAttendance: 0,
    revenueByCategory: [],
    topVendors: [],
  }
}

export async function getVendorHubReportsData(
  eventId?: string | null
): Promise<VendorHubReportsPayload> {
  const events = await getVendorHubEvents()
  const eventOptions: VendorHubReportEventOption[] = events.map((event) => ({
    id: event.id,
    name: event.name,
    eventDate: event.event_date,
  }))

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return {
      events: eventOptions,
      overview: emptyOverview(),
      vendorSales: [],
      boothPerformance: [],
    }
  }

  const scopedEvents =
    eventId && eventId !== "all"
      ? events.filter((event) => event.id === eventId)
      : events

  if (scopedEvents.length === 0) {
    return {
      events: eventOptions,
      overview: emptyOverview(),
      vendorSales: [],
      boothPerformance: [],
    }
  }

  const eventIds = scopedEvents.map((event) => event.id)
  const supabase = await createClient()

  const [
    { data: assignments },
    { data: payments },
    { data: booths },
    { data: boothTypes },
  ] = await Promise.all([
    supabase
      .from("vendor_hub_booth_assignments")
      .select("id, event_id, booth_id, contact_id, fee_amount, status")
      .in("event_id", eventIds),
    supabase
      .from("vendor_hub_payments")
      .select("id, event_id, contact_id, booth_assignment_id, amount, payment_type")
      .in("event_id", eventIds),
    supabase
      .from("vendor_hub_booths")
      .select("id, event_id, booth_type_id, status, number")
      .in("event_id", eventIds),
    supabase
      .from("vendor_hub_booth_types")
      .select("id, name, price")
      .eq("organization_id", organizationId),
  ])

  const assignmentRows = assignments || []
  const paymentRows = (payments || []).filter(
    (row) => (row.payment_type as string | null) !== "refund"
  )
  const boothRows = booths || []
  const boothTypeRows = boothTypes || []

  const contactIds = [
    ...new Set(
      assignmentRows
        .map((row) => row.contact_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ]

  const contactsById = new Map<
    string,
    {
      full_name: string | null
      first_name: string | null
      last_name: string | null
      organization_name: string | null
      company_name: string | null
    }
  >()

  if (contactIds.length > 0) {
    const { data: contacts } = await supabase
      .from("contacts")
      .select(
        "id, full_name, first_name, last_name, organization_name, company_name"
      )
      .eq("organization_id", organizationId)
      .in("id", contactIds)

    for (const contact of contacts || []) {
      contactsById.set(contact.id as string, {
        full_name: (contact.full_name as string | null) ?? null,
        first_name: (contact.first_name as string | null) ?? null,
        last_name: (contact.last_name as string | null) ?? null,
        organization_name: (contact.organization_name as string | null) ?? null,
        company_name: (contact.company_name as string | null) ?? null,
      })
    }
  }

  const boothTypeById = new Map(
    boothTypeRows.map((row) => [
      row.id as string,
      {
        name: (row.name as string) || "Booth",
        price: Number(row.price ?? 0),
      },
    ])
  )

  const boothById = new Map(
    boothRows.map((row) => [
      row.id as string,
      {
        boothTypeId: (row.booth_type_id as string | null) ?? null,
        status: (row.status as string | null) ?? null,
        number: (row.number as string | null) ?? null,
      },
    ])
  )

  const paidByAssignment = new Map<string, number>()
  const paidByContact = new Map<string, number>()
  for (const payment of paymentRows) {
    const amount = Number(payment.amount ?? 0)
    const assignmentId = payment.booth_assignment_id as string | null
    const contactId = payment.contact_id as string | null
    if (assignmentId) {
      paidByAssignment.set(
        assignmentId,
        (paidByAssignment.get(assignmentId) || 0) + amount
      )
    }
    if (contactId) {
      paidByContact.set(contactId, (paidByContact.get(contactId) || 0) + amount)
    }
  }

  const categoryStats = new Map<string, { vendors: Set<string>; revenue: number }>()
  const vendorSales: VendorHubVendorSalesRow[] = []
  const topVendorMap = new Map<
    string,
    { vendorName: string; category: string; feesPaid: number }
  >()

  for (const assignment of assignmentRows) {
    const contactId = assignment.contact_id as string | null
    const boothId = assignment.booth_id as string | null
    const booth = boothId ? boothById.get(boothId) : null
    const boothType = booth?.boothTypeId
      ? boothTypeById.get(booth.boothTypeId)
      : null
    const category = boothType?.name || "Uncategorized"
    const contact = contactId ? contactsById.get(contactId) : null
    const vendorName = contact
      ? formatContactDisplayName(contact)
      : "Unknown vendor"
    const boothFee = Number(assignment.fee_amount ?? boothType?.price ?? 0)
    const paid = assignment.id
      ? paidByAssignment.get(assignment.id as string) || 0
      : contactId
        ? paidByContact.get(contactId) || 0
        : 0
    const status = (assignment.status as string) || "reserved"

    vendorSales.push({
      vendorName,
      category,
      boothType: boothType?.name || "—",
      status,
      boothFee: formatMoneyNumber(boothFee),
      paid: formatMoneyNumber(paid),
    })

    if (!categoryStats.has(category)) {
      categoryStats.set(category, { vendors: new Set(), revenue: 0 })
    }
    const cat = categoryStats.get(category)!
    if (contactId) cat.vendors.add(contactId)
    cat.revenue += paid

    const key = contactId || vendorName
    const existing = topVendorMap.get(key)
    if (existing) {
      existing.feesPaid += paid
    } else {
      topVendorMap.set(key, {
        vendorName,
        category,
        feesPaid: paid,
      })
    }
  }

  const foodVendors = [...categoryStats.entries()]
    .filter(([name]) => /food|truck|cuisine|halal/i.test(name))
    .reduce((sum, [, stats]) => sum + stats.vendors.size, 0)

  const expectedAttendance = scopedEvents.reduce(
    (sum, event) => sum + Number(event.expected_attendees ?? 0),
    0
  )

  const totalRevenue = paymentRows.reduce(
    (sum, row) => sum + Number(row.amount ?? 0),
    0
  )

  const boothPerformanceMap = new Map<
    string,
    { total: number; allocated: number; revenue: number }
  >()

  for (const booth of boothRows) {
    const typeId = booth.booth_type_id as string | null
    const typeName = typeId
      ? boothTypeById.get(typeId)?.name || "Booth"
      : "Unassigned type"
    if (!boothPerformanceMap.has(typeName)) {
      boothPerformanceMap.set(typeName, { total: 0, allocated: 0, revenue: 0 })
    }
    const row = boothPerformanceMap.get(typeName)!
    row.total += 1
    const status = (booth.status as string | null) || ""
    if (["reserved", "assigned", "occupied", "confirmed"].includes(status)) {
      row.allocated += 1
    }
  }

  for (const assignment of assignmentRows) {
    const boothId = assignment.booth_id as string | null
    const booth = boothId ? boothById.get(boothId) : null
    const typeName = booth?.boothTypeId
      ? boothTypeById.get(booth.boothTypeId)?.name || "Booth"
      : "Unassigned type"
    if (!boothPerformanceMap.has(typeName)) {
      boothPerformanceMap.set(typeName, { total: 0, allocated: 0, revenue: 0 })
    }
    const paid = assignment.id
      ? paidByAssignment.get(assignment.id as string) || 0
      : 0
    boothPerformanceMap.get(typeName)!.revenue += paid
  }

  const boothPerformance: VendorHubBoothPerformanceRow[] = [
    ...boothPerformanceMap.entries(),
  ].map(([boothType, stats]) => {
    const available = Math.max(0, stats.total - stats.allocated)
    const utilizationPercent =
      stats.total > 0 ? Math.round((stats.allocated / stats.total) * 100) : 0
    return {
      boothType,
      total: stats.total,
      allocated: stats.allocated,
      available,
      utilizationPercent,
      revenue: formatMoneyNumber(stats.revenue),
    }
  })

  const uniqueVendorContacts = new Set(
    assignmentRows
      .map((row) => row.contact_id as string | null)
      .filter((id): id is string => Boolean(id))
  )

  return {
    events: eventOptions,
    overview: {
      totalRevenue: formatMoneyNumber(totalRevenue),
      totalVendors: uniqueVendorContacts.size,
      foodVendors,
      expectedAttendance,
      revenueByCategory: [...categoryStats.entries()]
        .map(([category, stats]) => ({
          category,
          vendors: stats.vendors.size,
          revenue: formatMoneyNumber(stats.revenue),
        }))
        .sort((a, b) => b.revenue - a.revenue),
      topVendors: [...topVendorMap.values()]
        .sort((a, b) => b.feesPaid - a.feesPaid)
        .slice(0, 10)
        .map((row) => ({
          ...row,
          feesPaid: formatMoneyNumber(row.feesPaid),
        })),
    },
    vendorSales: vendorSales.sort((a, b) => b.paid - a.paid),
    boothPerformance: boothPerformance.sort((a, b) => b.revenue - a.revenue),
  }
}
