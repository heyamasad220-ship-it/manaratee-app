"use server"

import { requireContactsViewAccess } from "@/lib/contacts/group-member-access"
import { normalizeGivingGroupKind } from "@/lib/donations/giving-group-kind"

export type GroupActivityItem = {
  id: string
  kind: "donation" | "event"
  date: string
  title: string
  detail: string | null
  amount: number | null
  href: string | null
}

/**
 * Activity feed for giving groups / departments.
 * Individual gifts are intentionally omitted — use Group giving for campaign totals.
 * Shows department events when a department is linked or provided.
 */
export async function fetchGroupActivityAction(
  groupContactId: string,
  options?: { departmentId?: string | null }
): Promise<
  | { success: true; items: GroupActivityItem[] }
  | { success: false; error: string }
> {
  const access = await requireContactsViewAccess()
  if (!access.ok) return { success: false, error: access.error }

  const { data: group, error: groupError } = await access.supabase
    .from("contacts")
    .select(
      "id, contact_type, full_name, giving_group_kind, linked_department_id, linked_hr_team_id"
    )
    .eq("organization_id", access.organizationId)
    .eq("id", groupContactId)
    .maybeSingle()

  let groupRow = group
  if (groupError) {
    const retry = await access.supabase
      .from("contacts")
      .select("id, contact_type, full_name")
      .eq("organization_id", access.organizationId)
      .eq("id", groupContactId)
      .maybeSingle()
    if (retry.error || !retry.data || retry.data.contact_type !== "group") {
      return { success: false, error: "Giving group not found." }
    }
    groupRow = {
      ...retry.data,
      giving_group_kind: "group_donation",
      linked_department_id: null,
      linked_hr_team_id: null,
    }
  } else if (!groupRow || groupRow.contact_type !== "group") {
    return { success: false, error: "Giving group not found." }
  }

  const items: GroupActivityItem[] = []

  const kind = normalizeGivingGroupKind(
    (groupRow as { giving_group_kind?: string | null }).giving_group_kind
  )
  const linkedDepartmentId =
    options?.departmentId ||
    (groupRow as { linked_department_id?: string | null }).linked_department_id ||
    null

  if (linkedDepartmentId && (kind === "department" || options?.departmentId)) {
    const { data: events } = await access.supabase
      .from("internal_events")
      .select("id, name, start_at, status")
      .eq("organization_id", access.organizationId)
      .eq("department_id", linkedDepartmentId)
      .order("start_at", { ascending: false })
      .limit(40)

    for (const event of events || []) {
      const startAt = event.start_at as string | null
      if (!startAt) continue
      items.push({
        id: `event-${event.id}`,
        kind: "event",
        date: startAt,
        title: (event.name as string | null)?.trim() || "Event",
        detail: event.status ? `Status: ${event.status}` : null,
        amount: null,
        href: "/events/overview",
      })
    }
  }

  items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  return { success: true, items: items.slice(0, 50) }
}

/** Department workspace Activity — events only (no individual gifts). */
export async function fetchDepartmentActivityAction(departmentId: string) {
  const access = await requireContactsViewAccess()
  if (!access.ok) return { success: false as const, error: access.error }

  const { data: events, error } = await access.supabase
    .from("internal_events")
    .select("id, name, start_at, status")
    .eq("organization_id", access.organizationId)
    .eq("department_id", departmentId)
    .order("start_at", { ascending: false })
    .limit(40)

  if (error) {
    return { success: false as const, error: error.message || "Could not load activity." }
  }

  const items: GroupActivityItem[] = []
  for (const event of events || []) {
    const startAt = event.start_at as string | null
    if (!startAt) continue
    items.push({
      id: `event-${event.id}`,
      kind: "event",
      date: startAt,
      title: (event.name as string | null)?.trim() || "Event",
      detail: event.status ? `Status: ${event.status}` : null,
      amount: null,
      href: "/events/overview",
    })
  }

  return { success: true as const, items }
}
