"use server"

import {
  fetchContactsList,
  type FetchContactsListInput,
} from "@/lib/contacts/contact-list-actions"
import type {
  ContactDirectoryExportRow,
  ContactDirectoryReportFilters,
  ContactDirectoryReportSummary,
  ContactReportTeamOption,
} from "@/lib/contacts/contact-report-types"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
import { hasPermission } from "@/lib/permissions/permissions"
import { createClient } from "@/lib/supabase/server"

const EXPORT_PAGE_SIZE = 500
const PREVIEW_PAGE_SIZE = 50

async function requireContactsView() {
  const allowed = await hasPermission(PERMISSIONS.CONTACTS_VIEW)
  if (!allowed) {
    return { ok: false as const, error: "Not authorized to view contact reports." }
  }
  return { ok: true as const }
}

function toListInput(
  filters: ContactDirectoryReportFilters,
  page: number,
  pageSize: number
): FetchContactsListInput {
  return {
    search: filters.search?.trim() || undefined,
    recordType:
      filters.recordType && filters.recordType !== "all" ? filters.recordType : undefined,
    role: filters.role && filters.role !== "all" ? filters.role : undefined,
    status: filters.status && filters.status !== "all" ? filters.status : undefined,
    teamId: filters.teamId && filters.teamId !== "all" ? filters.teamId : undefined,
    page,
    pageSize,
  }
}

async function fetchAddressMap(contactIds: string[]) {
  const map = new Map<
    string,
    Pick<ContactDirectoryExportRow, "address" | "city" | "state" | "zip" | "country">
  >()

  if (contactIds.length === 0) return map

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return map

  const batchSize = 200
  for (let index = 0; index < contactIds.length; index += batchSize) {
    const batch = contactIds.slice(index, index + batchSize)
    const { data, error } = await supabase
      .from("contacts")
      .select("id, address, city, state, zip, country")
      .eq("organization_id", organizationId)
      .in("id", batch)

    if (error) {
      console.warn("contact report address fetch failed:", error.message)
      continue
    }

    for (const row of data || []) {
      map.set(row.id as string, {
        address: (row.address as string | null) || "",
        city: (row.city as string | null) || "",
        state: (row.state as string | null) || "",
        zip: (row.zip as string | null) || "",
        country: (row.country as string | null) || "",
      })
    }
  }

  return map
}

export async function fetchContactReportTeamOptionsAction(): Promise<
  { success: true; teams: ContactReportTeamOption[] } | { success: false; error: string }
> {
  const access = await requireContactsView()
  if (!access.ok) return { success: false, error: access.error }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: true, teams: [] }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("hr_teams")
    .select("id, name")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true })

  if (error) {
    return { success: false, error: error.message }
  }

  return {
    success: true,
    teams: (data || []).map((row) => ({
      id: row.id as string,
      name: (row.name as string | null) || "Unnamed team",
    })),
  }
}

export async function fetchContactDirectorySummaryAction(
  filters: ContactDirectoryReportFilters
): Promise<
  { success: true; summary: ContactDirectoryReportSummary } | { success: false; error: string }
> {
  const access = await requireContactsView()
  if (!access.ok) return { success: false, error: access.error }

  try {
    const lockedType =
      filters.recordType && filters.recordType !== "all" ? filters.recordType : null

    if (lockedType === "individual") {
      const result = await fetchContactsList(toListInput(filters, 1, 1))
      return {
        success: true,
        summary: {
          total: result.total,
          people: result.total,
          organizations: 0,
          groups: 0,
        },
      }
    }

    if (lockedType === "organization") {
      const result = await fetchContactsList(toListInput(filters, 1, 1))
      return {
        success: true,
        summary: {
          total: result.total,
          people: 0,
          organizations: result.total,
          groups: 0,
        },
      }
    }

    if (lockedType === "group") {
      const result = await fetchContactsList(toListInput(filters, 1, 1))
      return {
        success: true,
        summary: {
          total: result.total,
          people: 0,
          organizations: 0,
          groups: result.total,
        },
      }
    }

    const [totalResult, peopleResult, organizationsResult, groupsResult] = await Promise.all([
      fetchContactsList(toListInput(filters, 1, 1)),
      fetchContactsList(
        toListInput({ ...filters, recordType: "individual" }, 1, 1)
      ),
      fetchContactsList(
        toListInput({ ...filters, recordType: "organization" }, 1, 1)
      ),
      fetchContactsList(toListInput({ ...filters, recordType: "group" }, 1, 1)),
    ])

    return {
      success: true,
      summary: {
        total: totalResult.total,
        people: peopleResult.total,
        organizations: organizationsResult.total,
        groups: groupsResult.total,
      },
    }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

export async function fetchContactDirectoryPageAction(input: {
  filters: ContactDirectoryReportFilters
  page?: number
}): Promise<
  | {
      success: true
      contacts: Awaited<ReturnType<typeof fetchContactsList>>["contacts"]
      total: number
      page: number
      pageSize: number
    }
  | { success: false; error: string }
> {
  const access = await requireContactsView()
  if (!access.ok) return { success: false, error: access.error }

  try {
    const page = Math.max(1, input.page ?? 1)
    const result = await fetchContactsList(
      toListInput(input.filters, page, PREVIEW_PAGE_SIZE)
    )

    return {
      success: true,
      contacts: result.contacts,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

export async function fetchContactDirectoryExportAction(
  filters: ContactDirectoryReportFilters
): Promise<
  | { success: true; contacts: ContactDirectoryExportRow[]; generatedAt: string }
  | { success: false; error: string }
> {
  const access = await requireContactsView()
  if (!access.ok) return { success: false, error: access.error }

  try {
    const collected: Awaited<ReturnType<typeof fetchContactsList>>["contacts"] = []
    let page = 1
    let total = 0

    do {
      const result = await fetchContactsList(
        toListInput(filters, page, EXPORT_PAGE_SIZE)
      )
      total = result.total
      collected.push(...result.contacts)
      if (collected.length >= total || result.contacts.length === 0) break
      page += 1
    } while (page <= 200)

    const addressMap = await fetchAddressMap(collected.map((contact) => contact.id))
    const contacts: ContactDirectoryExportRow[] = collected.map((contact) => {
      const address = addressMap.get(contact.id)
      return {
        ...contact,
        address: address?.address || "",
        city: address?.city || "",
        state: address?.state || "",
        zip: address?.zip || "",
        country: address?.country || "",
      }
    })

    return {
      success: true,
      contacts,
      generatedAt: new Date().toISOString(),
    }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}
