"use server"

import type {
  DirectoryDuplicateRow,
  DirectoryNewContactPeriod,
  DirectoryNewContactRow,
  DirectoryNewContactsPage,
} from "@/lib/directory/directory-report-types"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
import { hasPermission } from "@/lib/permissions/permissions"
import { createClient } from "@/lib/supabase/server"

const NEW_CONTACT_PAGE_SIZE = 25
const DUPLICATE_SCAN_PAGE = 1000
const DUPLICATE_SCAN_LIMIT = 20000

function directoryNewContactPeriodStart(
  period: DirectoryNewContactPeriod,
  now = new Date()
) {
  if (period === "month") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  }
  if (period === "30d") {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  }
  return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString()
}

async function requireDirectoryReports() {
  const allowed = await hasPermission(PERMISSIONS.CONTACTS_VIEW)
  if (!allowed) return { ok: false as const, error: "Not authorized to view Directory reports." }
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return { ok: false as const, error: "No organization selected." }
  const supabase = await createClient()
  return { ok: true as const, organizationId, supabase }
}

async function loadDuplicatePeople(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string
) {
  const rows: Array<{
    id: string
    full_name: string | null
    email: string | null
    phone: string | null
  }> = []
  let from = 0

  while (from < DUPLICATE_SCAN_LIMIT) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, full_name, email, phone")
      .eq("organization_id", organizationId)
      .eq("contact_type", "individual")
      .range(from, from + DUPLICATE_SCAN_PAGE - 1)

    if (error) return { ok: false as const, error: error.message }
    const batch = data || []
    rows.push(...batch)
    if (batch.length < DUPLICATE_SCAN_PAGE) break
    from += DUPLICATE_SCAN_PAGE
  }

  return { ok: true as const, rows }
}

function buildDuplicateRows(
  rows: Array<{
    id: string
    full_name: string | null
    email: string | null
    phone: string | null
  }>
) {
  const emailMap = new Map<string, { ids: string[]; names: string[] }>()
  const phoneMap = new Map<string, { ids: string[]; names: string[] }>()

  for (const row of rows) {
    const email = String(row.email || "").trim().toLowerCase()
    const phone = String(row.phone || "").replace(/\D/g, "")
    const name = row.full_name || "Unnamed"
    const id = row.id
    if (email) {
      const current = emailMap.get(email) || { ids: [], names: [] }
      current.ids.push(id)
      current.names.push(name)
      emailMap.set(email, current)
    }
    if (phone.length >= 7) {
      const current = phoneMap.get(phone) || { ids: [], names: [] }
      current.ids.push(id)
      current.names.push(name)
      phoneMap.set(phone, current)
    }
  }

  const duplicates: DirectoryDuplicateRow[] = []
  for (const [value, match] of emailMap) {
    if (match.ids.length < 2) continue
    duplicates.push({
      key: `email:${value}`,
      matchType: "email",
      value,
      contactIds: match.ids,
      names: match.names,
    })
  }
  for (const [value, match] of phoneMap) {
    if (match.ids.length < 2) continue
    duplicates.push({
      key: `phone:${value}`,
      matchType: "phone",
      value,
      contactIds: match.ids,
      names: match.names,
    })
  }
  return duplicates.slice(0, 100)
}

export async function fetchDirectoryNewContactsAction(
  period: DirectoryNewContactPeriod = "month",
  page = 1
): Promise<{ success: true; result: DirectoryNewContactsPage } | { success: false; error: string }> {
  const access = await requireDirectoryReports()
  if (!access.ok) return { success: false, error: access.error }

  const since = directoryNewContactPeriodStart(period)
  const safePage = Math.max(1, page)
  const from = (safePage - 1) * NEW_CONTACT_PAGE_SIZE
  const to = from + NEW_CONTACT_PAGE_SIZE - 1

  const [peopleRes, organizationsRes, listRes] = await Promise.all([
    access.supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", access.organizationId)
      .eq("contact_type", "individual")
      .gte("created_at", since),
    access.supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", access.organizationId)
      .eq("contact_type", "organization")
      .gte("created_at", since),
    access.supabase
      .from("contacts")
      .select("id, full_name, contact_type, created_at", { count: "exact" })
      .eq("organization_id", access.organizationId)
      .in("contact_type", ["individual", "organization"])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .range(from, to),
  ])

  if (peopleRes.error) return { success: false, error: peopleRes.error.message }
  if (organizationsRes.error) return { success: false, error: organizationsRes.error.message }
  if (listRes.error) return { success: false, error: listRes.error.message }

  const contacts: DirectoryNewContactRow[] = (listRes.data || []).map((row) => ({
    id: row.id as string,
    name: (row.full_name as string) || "Unnamed",
    kind: row.contact_type === "organization" ? "organization" : "person",
    createdAt: String(row.created_at || ""),
  }))

  return {
    success: true,
    result: {
      period,
      peopleCount: peopleRes.count ?? 0,
      organizationCount: organizationsRes.count ?? 0,
      total: listRes.count ?? contacts.length,
      page: safePage,
      pageSize: NEW_CONTACT_PAGE_SIZE,
      contacts,
    },
  }
}

export async function fetchDirectoryReportPageAction() {
  const access = await requireDirectoryReports()
  if (!access.ok) return { success: false as const, error: access.error }

  const [duplicatesResult, newContacts] = await Promise.all([
    loadDuplicatePeople(access.supabase, access.organizationId),
    fetchDirectoryNewContactsAction("month", 1),
  ])

  if (!duplicatesResult.ok) return { success: false as const, error: duplicatesResult.error }
  if (!newContacts.success) return { success: false as const, error: newContacts.error }

  return {
    success: true as const,
    duplicates: buildDuplicateRows(duplicatesResult.rows),
    newContacts: newContacts.result,
  }
}
