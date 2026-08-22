import type { SupabaseClient } from "@supabase/supabase-js"

import type { ContactListRow } from "@/lib/contacts/contact-list-types"
import { loadContactGivingStatsMap } from "@/lib/contacts/family-giving-data"
import {
  directoryRoleExtraColumns,
  type DirectoryDynamicRoleKey,
} from "@/lib/directory/directory-roles"
import { getEmploymentTypeLabel } from "@/lib/hr/staff-role-utils"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
import { hasPermission } from "@/lib/permissions/permissions"
import {
  VENDOR_ORG_APPLICATION_MODULE,
  VENDOR_ORG_APPLICATION_TYPE,
} from "@/lib/vendor-hub/vendor-participation-model"

export type DirectoryRoleSummary = {
  cells: Record<string, string>
}

function dash(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed || "—"
}

function formatUsd(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatStatus(value: string | null | undefined) {
  const raw = (value || "").trim()
  if (!raw) return "—"
  return raw.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function relatedName(value: unknown): string | null {
  if (!value) return null
  if (Array.isArray(value)) {
    const first = value[0] as { name?: string | null } | undefined
    return first?.name?.trim() || null
  }
  if (typeof value === "object" && "name" in value) {
    const name = (value as { name?: string | null }).name
    return name?.trim() || null
  }
  return null
}

function personDisplayName(value: unknown): string | null {
  if (!value) return null
  const row = Array.isArray(value) ? value[0] : value
  if (!row || typeof row !== "object") return null
  const record = row as { full_name?: string | null; first_name?: string | null; last_name?: string | null }
  const full = record.full_name?.trim()
  if (full) return full
  const parts = [record.first_name, record.last_name].filter(Boolean)
  return parts.length > 0 ? parts.join(" ") : null
}

function vendorTypeFromFormData(formData: unknown): string | null {
  if (!formData || typeof formData !== "object") return null
  const record = formData as Record<string, unknown>
  for (const key of ["vendor_type_name", "vendor_type"]) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return null
}

function listNames(names: string[], limit = 3) {
  const unique = Array.from(new Set(names.map((name) => name.trim()).filter(Boolean)))
  if (unique.length === 0) return "—"
  if (unique.length <= limit) return unique.join(", ")
  return `${unique.slice(0, limit).join(", ")} +${unique.length - limit}`
}

export async function attachDirectoryRoleSummaries(input: {
  supabase: SupabaseClient
  organizationId: string
  roleKey: DirectoryDynamicRoleKey
  contacts: ContactListRow[]
}): Promise<ContactListRow[]> {
  const columns = directoryRoleExtraColumns(input.roleKey)
  if (columns.length === 0 || input.contacts.length === 0) {
    return input.contacts
  }

  const ids = input.contacts.map((contact) => contact.id)
  const byId = new Map<string, Record<string, string>>()
  for (const id of ids) byId.set(id, {})

  try {
    switch (input.roleKey) {
      case "employees":
      case "service-providers":
      case "childcare-providers":
        await attachStaffSummaries(input.supabase, input.organizationId, ids, byId)
        break
      case "volunteers":
        await attachVolunteerSummaries(input.supabase, input.organizationId, ids, byId)
        break
      case "members":
        await attachMembershipSummaries(input.supabase, input.organizationId, ids, byId)
        await attachHouseholdSummaries(input.supabase, input.organizationId, ids, byId)
        break
      case "donors":
        await attachDonorSummaries(input.supabase, input.organizationId, ids, byId)
        break
      case "parents":
        await attachParentSummaries(input.supabase, input.organizationId, ids, byId)
        break
      case "vendors":
        await attachVendorSummaries(input.supabase, input.organizationId, ids, byId)
        break
      case "rental-customers":
        await attachRentalSummaries(input.supabase, input.organizationId, ids, byId)
        break
      default:
        break
    }
  } catch (error) {
    console.warn("directory role summaries:", error instanceof Error ? error.message : error)
  }

  for (const contact of input.contacts) {
    const cells = byId.get(contact.id)
    if (!cells) continue
    if (input.roleKey === "volunteers") {
      cells.groups = contact.teams.length
        ? contact.teams.map((team) => team.name).join(", ")
        : "—"
    }
    if (input.roleKey === "vendors") {
      cells.primaryContact = dash(contact.primaryContactName)
    }
  }

  return input.contacts.map((contact) => ({
    ...contact,
    roleSummary: {
      cells: byId.get(contact.id) ?? {},
    },
  }))
}

async function attachStaffSummaries(
  supabase: SupabaseClient,
  organizationId: string,
  ids: string[],
  byId: Map<string, Record<string, string>>
) {
  const { data, error } = await supabase
    .from("staff")
    .select(
      "contact_id, staff_type, status, position, hr_positions:position_id(name), departments:department_id(name)"
    )
    .eq("organization_id", organizationId)
    .in("contact_id", ids)

  if (error) {
    console.warn("directory staff summaries:", error.message)
    return
  }

  for (const row of data || []) {
    const contactId = row.contact_id as string | null
    if (!contactId) continue
    const cells = byId.get(contactId)
    if (!cells) continue
    cells.department = dash(relatedName(row.departments))
    cells.position = dash(
      relatedName(row.hr_positions) || (row.position as string | null)
    )
    cells.employmentType = dash(getEmploymentTypeLabel(row.staff_type as string | null))
    cells.roleStatus = dash(formatStatus(row.status as string | null))
  }
}

async function attachVolunteerSummaries(
  supabase: SupabaseClient,
  organizationId: string,
  ids: string[],
  byId: Map<string, Record<string, string>>
) {
  const { data, error } = await supabase
    .from("volunteers")
    .select("contact_id, status")
    .eq("organization_id", organizationId)
    .in("contact_id", ids)

  if (error) {
    console.warn("directory volunteer summaries:", error.message)
    return
  }

  for (const row of data || []) {
    const contactId = row.contact_id as string | null
    if (!contactId) continue
    const cells = byId.get(contactId)
    if (!cells) continue
    cells.roleStatus = dash(formatStatus(row.status as string | null))
  }
}

async function attachMembershipSummaries(
  supabase: SupabaseClient,
  organizationId: string,
  ids: string[],
  byId: Map<string, Record<string, string>>
) {
  const { data, error } = await supabase
    .from("memberships")
    .select(
      "contact_id, status, start_date, end_date, renewal_date, membership_types:membership_type_id(name)"
    )
    .eq("organization_id", organizationId)
    .in("contact_id", ids)
    .order("start_date", { ascending: false })

  if (error) {
    console.warn("directory membership summaries:", error.message)
    return
  }

  for (const row of data || []) {
    const contactId = row.contact_id as string | null
    if (!contactId) continue
    const cells = byId.get(contactId)
    if (!cells || cells.membershipType) continue
    const start = formatDate(row.start_date as string | null)
    const renew = row.renewal_date
      ? `renews ${formatDate(row.renewal_date as string)}`
      : row.end_date
        ? `ends ${formatDate(row.end_date as string)}`
        : null
    cells.membershipType = dash(relatedName(row.membership_types))
    cells.roleStatus = dash(formatStatus(row.status as string | null))
    cells.dates = renew ? `${start} · ${renew}` : start
  }
}

async function attachHouseholdSummaries(
  supabase: SupabaseClient,
  organizationId: string,
  ids: string[],
  byId: Map<string, Record<string, string>>
) {
  const { data, error } = await supabase
    .from("family_members")
    .select("contact_id, families:family_id(name)")
    .eq("organization_id", organizationId)
    .in("contact_id", ids)
    .is("end_date", null)

  if (error) {
    console.warn("directory household summaries:", error.message)
    return
  }

  for (const row of data || []) {
    const contactId = row.contact_id as string | null
    if (!contactId) continue
    const cells = byId.get(contactId)
    if (!cells || cells.household) continue
    cells.household = dash(relatedName(row.families))
  }
}

async function attachDonorSummaries(
  supabase: SupabaseClient,
  organizationId: string,
  ids: string[],
  byId: Map<string, Record<string, string>>
) {
  const canViewGiving = await hasPermission(PERMISSIONS.DONATIONS_VIEW)
  if (!canViewGiving) {
    for (const id of ids) {
      const cells = byId.get(id)
      if (!cells) continue
      cells.lifetimeGiving = "—"
      cells.lastGift = "—"
      cells.activePledge = "—"
    }
    return
  }

  const stats = await loadContactGivingStatsMap(supabase, organizationId, ids)
  for (const [contactId, giving] of stats.entries()) {
    const cells = byId.get(contactId)
    if (!cells) continue
    cells.lifetimeGiving = formatUsd(giving.totalDonations)
    cells.lastGift = formatDate(giving.lastDonationDate)
  }

  const { data, error } = await supabase
    .from("pledges")
    .select("contact_id, status, balance_remaining, amount_pledged")
    .eq("organization_id", organizationId)
    .in("contact_id", ids)
    .in("status", ["open", "partial"])

  if (error) {
    console.warn("directory pledge summaries:", error.message)
    return
  }

  const pledgeByContact = new Map<string, number>()
  for (const row of data || []) {
    const contactId = row.contact_id as string | null
    if (!contactId) continue
    const remaining = Number(row.balance_remaining ?? row.amount_pledged ?? 0)
    pledgeByContact.set(contactId, (pledgeByContact.get(contactId) ?? 0) + Math.max(remaining, 0))
  }

  for (const [contactId, remaining] of pledgeByContact.entries()) {
    const cells = byId.get(contactId)
    if (!cells) continue
    cells.activePledge = remaining > 0 ? formatUsd(remaining) : "—"
  }
}

async function attachParentSummaries(
  supabase: SupabaseClient,
  organizationId: string,
  ids: string[],
  byId: Map<string, Record<string, string>>
) {
  const { data: parentRows, error: parentError } = await supabase
    .from("family_members")
    .select("contact_id, family_id, families:family_id(name)")
    .eq("organization_id", organizationId)
    .in("contact_id", ids)
    .in("role", ["parent", "guardian"])
    .is("end_date", null)

  if (parentError) {
    console.warn("directory parent summaries:", parentError.message)
    return
  }

  const familyIds = Array.from(
    new Set(
      (parentRows || [])
        .map((row) => row.family_id as string | null)
        .filter((id): id is string => Boolean(id))
    )
  )

  const childrenByFamily = new Map<string, string[]>()
  if (familyIds.length > 0) {
    const { data: childRows, error: childError } = await supabase
      .from("family_members")
      .select("family_id, contact_id, person_id, contacts:contact_id(full_name), people:person_id(first_name, last_name)")
      .eq("organization_id", organizationId)
      .in("family_id", familyIds)
      .eq("role", "child")
      .is("end_date", null)

    if (childError) {
      console.warn("directory parent children:", childError.message)
    } else {
      for (const row of childRows || []) {
        const familyId = row.family_id as string | null
        if (!familyId) continue
        const name =
          personDisplayName(row.contacts) || personDisplayName(row.people) || "Unnamed"
        const list = childrenByFamily.get(familyId) || []
        list.push(name)
        childrenByFamily.set(familyId, list)
      }
    }
  }

  for (const row of parentRows || []) {
    const contactId = row.contact_id as string | null
    const familyId = row.family_id as string | null
    if (!contactId) continue
    const cells = byId.get(contactId)
    if (!cells) continue
    cells.household = dash(relatedName(row.families))
    cells.children = familyId ? listNames(childrenByFamily.get(familyId) || []) : "—"
  }
}

async function attachVendorSummaries(
  supabase: SupabaseClient,
  organizationId: string,
  ids: string[],
  byId: Map<string, Record<string, string>>
) {
  const { data, error } = await supabase
    .from("applications")
    .select("contact_id, form_data")
    .eq("organization_id", organizationId)
    .eq("application_type", VENDOR_ORG_APPLICATION_TYPE)
    .eq("module_owner", VENDOR_ORG_APPLICATION_MODULE)
    .in("contact_id", ids)
    .order("created_at", { ascending: false })

  if (error) {
    console.warn("directory vendor summaries:", error.message)
    return
  }

  for (const row of data || []) {
    const contactId = row.contact_id as string | null
    if (!contactId) continue
    const cells = byId.get(contactId)
    if (!cells || cells.vendorType) continue
    cells.vendorType = dash(vendorTypeFromFormData(row.form_data))
  }
}

async function attachRentalSummaries(
  supabase: SupabaseClient,
  organizationId: string,
  ids: string[],
  byId: Map<string, Record<string, string>>
) {
  const { data, error } = await supabase
    .from("venue_rentals")
    .select("billing_contact_id, event_date, created_at")
    .eq("organization_id", organizationId)
    .in("billing_contact_id", ids)

  if (error) {
    console.warn("directory rental summaries:", error.message)
    return
  }

  const counts = new Map<string, { count: number; last: string | null }>()
  for (const row of data || []) {
    const contactId = row.billing_contact_id as string | null
    if (!contactId) continue
    const current = counts.get(contactId) || { count: 0, last: null as string | null }
    current.count += 1
    const stamp = (row.event_date as string | null) || (row.created_at as string | null)
    if (stamp && (!current.last || stamp > current.last)) current.last = stamp
    counts.set(contactId, current)
  }

  for (const [contactId, stats] of counts.entries()) {
    const cells = byId.get(contactId)
    if (!cells) continue
    cells.rentalCount = String(stats.count)
    cells.lastRental = formatDate(stats.last)
  }
}
