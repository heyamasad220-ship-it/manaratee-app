"use server"

import { VENUE_RENTAL_CUSTOMER_EXCLUDED_STATUSES } from "@/lib/contacts/contact-affiliation-rules"
import { fetchContactsList } from "@/lib/contacts/contact-list-actions"
import type { FetchContactsListResult } from "@/lib/contacts/contact-list-types"
import {
  getDirectoryRoleDef,
  type DirectoryDynamicRoleKey,
} from "@/lib/directory/directory-roles"
import { attachDirectoryRoleSummaries } from "@/lib/directory/directory-role-summaries"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { PERMISSIONS } from "@/lib/permissions/permission-keys"
import { hasPermission } from "@/lib/permissions/permissions"
import { createClient } from "@/lib/supabase/server"

const DEFAULT_PAGE_SIZE = 50
const PARENT_FAMILY_ROLES = ["parent", "guardian"] as const

function uniqueIds(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((id): id is string => Boolean(id))))
}

async function loadContactsByIds(
  ids: string[],
  page: number,
  pageSize: number,
  search?: string
): Promise<FetchContactsListResult> {
  if (ids.length === 0) {
    return { contacts: [], total: 0, page, pageSize, isRecentView: !search }
  }

  const from = (page - 1) * pageSize
  const pageIds = ids.slice(from, from + pageSize)
  if (pageIds.length === 0) {
    return { contacts: [], total: ids.length, page, pageSize, isRecentView: !search }
  }
  const result = await fetchContactsList({
    search,
    contactIds: pageIds,
    page: 1,
    pageSize: pageIds.length || pageSize,
  })

  return {
    contacts: result.contacts,
    total: search ? result.total : ids.length,
    page,
    pageSize,
    isRecentView: !search,
  }
}

export async function fetchDirectoryRoleListAction(input: {
  roleKey: DirectoryDynamicRoleKey
  search?: string
  page?: number
  pageSize?: number
}): Promise<FetchContactsListResult> {
  const allowed = await hasPermission(PERMISSIONS.CONTACTS_VIEW)
  const page = Math.max(1, input.page ?? 1)
  const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE
  const empty: FetchContactsListResult = {
    contacts: [],
    total: 0,
    page,
    pageSize,
    isRecentView: !input.search,
  }

  if (!allowed) return empty

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return empty

  const supabase = await createClient()
  const def = getDirectoryRoleDef(input.roleKey)

  let result: FetchContactsListResult = empty

  if (def.source === "contact_roles" && def.contactRole) {
    result = await fetchContactsList({
      search: input.search,
      role: def.contactRole,
      page,
      pageSize,
    })
  } else if (def.source === "parents") {
    const { data, error } = await supabase
      .from("family_members")
      .select("contact_id")
      .eq("organization_id", organizationId)
      .in("role", [...PARENT_FAMILY_ROLES])
      .is("end_date", null)
      .not("contact_id", "is", null)

    if (error) {
      console.warn("directory parents list:", error.message)
      return empty
    }

    result = await loadContactsByIds(
      uniqueIds((data || []).map((row) => row.contact_id as string | null)),
      page,
      pageSize,
      input.search
    )
  } else {
    const { data, error } = await supabase
      .from("venue_rentals")
      .select("billing_contact_id")
      .eq("organization_id", organizationId)
      .not("billing_contact_id", "is", null)
      .not(
        "status",
        "in",
        `(${VENUE_RENTAL_CUSTOMER_EXCLUDED_STATUSES.join(",")})`
      )

    if (error) {
      console.warn("directory rental customers list:", error.message)
      return empty
    }

    result = await loadContactsByIds(
      uniqueIds((data || []).map((row) => row.billing_contact_id as string | null)),
      page,
      pageSize,
      input.search
    )
  }

  const contacts = await attachDirectoryRoleSummaries({
    supabase,
    organizationId,
    roleKey: input.roleKey,
    contacts: result.contacts,
  })

  return { ...result, contacts }
}
