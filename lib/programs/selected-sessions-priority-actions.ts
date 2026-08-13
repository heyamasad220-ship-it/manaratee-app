"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { resolveSessionEffectiveCapacity } from "@/lib/programs/program-catalog-capacity"
import { promoteWaitlistRpc } from "@/lib/programs/program-lifecycle-actions"

function revalidateOfferingPaths(programId: string) {
  revalidatePath(`/programs/${programId}`)
  revalidatePath(`/programs/${programId}/offerings`)
  revalidatePath("/programs/registrations")
  revalidatePath("/workforce?tab=departments")
  revalidatePath(`/customer/programs/${programId}`)
  revalidatePath(`/customer/programs/${programId}/register`)
}

function parsePreferredSessionIds(preferredWeeks: unknown): string[] {
  if (!Array.isArray(preferredWeeks)) return []
  return preferredWeeks
    .map((value) => String(value || "").trim())
    .filter((value) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value
      )
    )
}

type SessionCapRow = {
  id: string
  capacity: number | null
  enrolled: number | null
}

function sessionHasOpenSeat(
  sessionId: string,
  sessions: SessionCapRow[],
  offering: { capacity_mode?: string | null; capacity?: number | null },
  reservedByPending: Map<string, number>
): boolean {
  const session = sessions.find((row) => row.id === sessionId)
  if (!session) return false
  const capacity = resolveSessionEffectiveCapacity(session.capacity, offering)
  if (capacity <= 0) return true
  const enrolled =
    Math.max(0, Number(session.enrolled || 0)) +
    (reservedByPending.get(sessionId) || 0)
  return enrolled < capacity
}

/**
 * FIFO: promote waitlist rows whose preferred weeks all still have seats.
 * Skips rows that cannot fit fully; continues until a full pass promotes none.
 */
export async function autoPromoteSelectedSessionsWaitlist(input: {
  organizationId: string
  programId: string
  offeringId: string
}): Promise<{ promoted: number; skipped: number }> {
  const supabase = await createClient()

  const { data: offering, error: offeringError } = await supabase
    .from("program_offerings")
    .select("id, capacity, capacity_mode")
    .eq("id", input.offeringId)
    .eq("organization_id", input.organizationId)
    .maybeSingle()

  if (offeringError || !offering) {
    throw new Error("Offering not found")
  }

  let promoted = 0
  let skipped = 0

  for (let pass = 0; pass < 50; pass++) {
    const { data: sessions, error: sessionsError } = await supabase
      .from("program_sessions")
      .select("id, capacity, enrolled, status")
      .eq("organization_id", input.organizationId)
      .eq("offering_id", input.offeringId)
      .eq("status", "active")

    if (sessionsError) {
      throw new Error(sessionsError.message)
    }

    const sessionRows = (sessions || []) as SessionCapRow[]

    const { data: waitlistRows, error: waitlistError } = await supabase
      .from("program_waitlist")
      .select("id, preferred_weeks, position, created_at, status, offering_id")
      .eq("organization_id", input.organizationId)
      .eq("program_id", input.programId)
      .in("status", ["waiting", "offered"])
      .order("position", { ascending: true })
      .order("created_at", { ascending: true })

    if (waitlistError) {
      throw new Error(waitlistError.message)
    }

    const candidates = (waitlistRows || []).filter((row) => {
      const offeringId = row.offering_id as string | null
      return !offeringId || offeringId === input.offeringId
    })

    let promotedThisPass = 0
    const reserved = new Map<string, number>()

    for (const row of candidates) {
      const preferred = parsePreferredSessionIds(row.preferred_weeks)
      if (preferred.length === 0) {
        skipped++
        continue
      }

      const fits = preferred.every((sessionId) =>
        sessionHasOpenSeat(
          sessionId,
          sessionRows,
          {
            capacity_mode: offering.capacity_mode as string | null,
            capacity:
              offering.capacity == null ? null : Number(offering.capacity),
          },
          reserved
        )
      )

      if (!fits) {
        skipped++
        continue
      }

      try {
        await promoteWaitlistRpc({
          organizationId: input.organizationId,
          waitlistId: row.id as string,
        })
        promoted++
        promotedThisPass++
        for (const sessionId of preferred) {
          reserved.set(sessionId, (reserved.get(sessionId) || 0) + 1)
        }
      } catch (error) {
        console.warn(
          "autoPromoteSelectedSessionsWaitlist skip:",
          error instanceof Error ? error.message : error
        )
        skipped++
      }
    }

    if (promotedThisPass === 0) break
  }

  return { promoted, skipped }
}

export async function setSelectedSessionsOpen(input: {
  programId: string
  offeringId: string
  open: boolean
}): Promise<{ promoted: number; skipped: number }> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase
    .from("program_offerings")
    .update({
      selected_sessions_open: input.open,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.offeringId)
    .eq("program_id", input.programId)
    .eq("organization_id", organizationId)

  if (error) {
    if (error.message?.includes("selected_sessions_open")) {
      throw new Error(
        "Run scripts/245_selected_sessions_priority.sql in Supabase, then try again."
      )
    }
    throw new Error(error.message)
  }

  let result = { promoted: 0, skipped: 0 }
  if (input.open) {
    result = await autoPromoteSelectedSessionsWaitlist({
      organizationId,
      programId: input.programId,
      offeringId: input.offeringId,
    })
  }

  revalidateOfferingPaths(input.programId)
  return result
}
