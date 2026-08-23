"use server"

import { fetchDirectoryNavSummary } from "@/lib/directory/directory-nav-summary"
import { DIRECTORY_DYNAMIC_ROLE_DEFS } from "@/lib/directory/directory-roles"
import type {
  DirectoryCompletenessStats,
  DirectoryDuplicateRow,
  DirectoryGrowthPoint,
  DirectoryRoleDistributionRow,
} from "@/lib/directory/directory-report-types"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
import { hasPermission } from "@/lib/permissions/permissions"
import { createClient } from "@/lib/supabase/server"

function startOfMonthUtc(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function monthKey(value: string) {
  return value.slice(0, 7)
}

export async function fetchDirectoryReportStatsAction(): Promise<
  | {
      success: true
      roleDistribution: DirectoryRoleDistributionRow[]
      completeness: DirectoryCompletenessStats
      growth: DirectoryGrowthPoint[]
      duplicates: DirectoryDuplicateRow[]
      uniquePeople: number
    }
  | { success: false; error: string }
> {
  const allowed = await hasPermission(PERMISSIONS.CONTACTS_VIEW)
  if (!allowed) {
    return { success: false, error: "Not authorized to view Directory reports." }
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false, error: "No organization selected." }
  }

  const supabase = await createClient()
  const summary = await fetchDirectoryNavSummary(organizationId)

  const roleDistribution = DIRECTORY_DYNAMIC_ROLE_DEFS.filter(
    (def) => def.key !== "service-providers" || summary.facilitiesEnabled
  ).map((def) => ({
    key: def.key,
    label: def.label,
    count: summary.roles[def.key] ?? 0,
  }))

  const [
    peopleRes,
    missingEmailRes,
    missingPhoneRes,
    missingAddressRes,
    roleRowsRes,
    growthRowsRes,
    duplicateSourceRes,
  ] = await Promise.all([
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("contact_type", "individual"),
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("contact_type", "individual")
      .or("email.is.null,email.eq."),
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("contact_type", "individual")
      .or("phone.is.null,phone.eq."),
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("contact_type", "individual")
      .or("address.is.null,address.eq."),
    supabase
      .from("contact_roles")
      .select("contact_id")
      .eq("organization_id", organizationId),
    supabase
      .from("contacts")
      .select("created_at, contact_type")
      .eq("organization_id", organizationId)
      .gte("created_at", startOfMonthUtc(new Date(Date.now() - 1000 * 60 * 60 * 24 * 365)).toISOString())
      .in("contact_type", ["individual", "organization"]),
    supabase
      .from("contacts")
      .select("id, full_name, email, phone")
      .eq("organization_id", organizationId)
      .eq("contact_type", "individual")
      .limit(5000),
  ])

  const people = peopleRes.count ?? 0
  const contactIdsWithRoles = new Set(
    (roleRowsRes.data || []).map((row) => row.contact_id as string)
  )

  const growthMap = new Map<string, DirectoryGrowthPoint>()
  for (let i = 11; i >= 0; i--) {
    const date = new Date()
    date.setUTCDate(1)
    date.setUTCMonth(date.getUTCMonth() - i)
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
    growthMap.set(key, { month: key, people: 0, organizations: 0 })
  }

  for (const row of growthRowsRes.data || []) {
    const key = monthKey(String(row.created_at || ""))
    const point = growthMap.get(key)
    if (!point) continue
    if (row.contact_type === "organization") point.organizations += 1
    else point.people += 1
  }

  const emailMap = new Map<string, { ids: string[]; names: string[] }>()
  const phoneMap = new Map<string, { ids: string[]; names: string[] }>()
  for (const row of duplicateSourceRes.data || []) {
    const email = String(row.email || "").trim().toLowerCase()
    const phone = String(row.phone || "").replace(/\D/g, "")
    const name = (row.full_name as string) || "Unnamed"
    const id = row.id as string
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

  const noRole = Math.max(0, people - contactIdsWithRoles.size)

  return {
    success: true,
    uniquePeople: people,
    roleDistribution,
    completeness: {
      people,
      missingEmail: missingEmailRes.count ?? 0,
      missingPhone: missingPhoneRes.count ?? 0,
      missingAddress: missingAddressRes.count ?? 0,
      noRole,
    },
    growth: Array.from(growthMap.values()),
    duplicates: duplicates.slice(0, 100),
  }
}
