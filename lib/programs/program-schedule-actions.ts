"use server"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"

import { getBlockingReservationsForVenue } from "@/lib/bookings/venue-rental-queries"
import { syncOperationalBriefForProgram } from "@/lib/operational-briefs/operational-brief-queries"
import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { assertCanManageProgram } from "@/lib/programs/program-access"
import { programOfferingManageHref } from "@/lib/programs/program-offering-paths"
import { getInstructorScheduleConflicts } from "@/lib/programs/program-schedule-queries"
import {
  combineDateAndTime,
  dayNameToIndex,
  rangesOverlap,
  toDateParam,
} from "@/lib/reservations/reservation-time"

type ScheduleItemInput = {
  program_id: string
  offering_id: string
  title: string
  day_of_week: string
  start_time: string
  end_time: string
  location?: string
  venue_id?: string | null
  instructor_name?: string
  capacity?: number
  color?: string
}

type CreateRecurringScheduleInput = Omit<ScheduleItemInput, "day_of_week"> & {
  days_of_week: string[]
}

function revalidateSchedulePaths(
  programId: string,
  offeringId: string,
  departmentId?: string | null
) {
  revalidatePath(`/programs/${programId}`)
  revalidatePath(`/programs/${programId}/offerings`)
  revalidatePath(
    programOfferingManageHref(programId, offeringId, { departmentId })
  )
  revalidatePath(`/customer/programs/${programId}`)
  revalidatePath("/programs/schedule")
  revalidatePath("/facilities/calendar")
  revalidatePath("/facilities/availability")
  revalidatePath("/facilities/reservation-center")
  revalidatePath("/facilities/overview")
}

async function assertOfferingBelongsToProgram(
  organizationId: string,
  programId: string,
  offeringId: string
) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("program_offerings")
    .select("id, start_date, end_date")
    .eq("id", offeringId)
    .eq("program_id", programId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error("Offering not found for this program")
  }

  return data as {
    id: string
    start_date: string | null
    end_date: string | null
  }
}

async function checkInstructorConflicts(input: {
  program_id: string
  day_of_week: string
  start_time: string
  end_time: string
  instructor_name?: string
  exclude_item_id?: string
}) {
  if (!input.instructor_name) return []

  return getInstructorScheduleConflicts({
    programId: input.program_id,
    dayOfWeek: input.day_of_week,
    startTime: input.start_time,
    endTime: input.end_time,
    instructorName: input.instructor_name,
    excludeItemId: input.exclude_item_id,
  })
}

/**
 * Expand recurring weekly slots across the offering date range and check the
 * shared facility schedule (occupied windows include setup/cleanup on stored rows).
 */
async function assertFacilityAvailabilityForSchedule(input: {
  organizationId: string
  venueId: string | null | undefined
  dayOfWeek: string
  startTime: string
  endTime: string
  offeringStartDate: string | null
  offeringEndDate: string | null
  excludeScheduleItemId?: string
}) {
  if (!input.venueId) return

  const dayIndex = dayNameToIndex(input.dayOfWeek)
  if (dayIndex === null) return

  const rangeStart = input.offeringStartDate
    ? new Date(`${input.offeringStartDate}T00:00:00`)
    : new Date()
  const rangeEnd = input.offeringEndDate
    ? new Date(`${input.offeringEndDate}T23:59:59`)
    : new Date(rangeStart.getTime() + 90 * 24 * 60 * 60 * 1000)

  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
    return
  }

  const blocking = await getBlockingReservationsForVenue(
    input.organizationId,
    input.venueId,
    rangeStart.toISOString(),
    rangeEnd.toISOString()
  )

  const excludePrefix = input.excludeScheduleItemId
    ? `program-schedule-${input.excludeScheduleItemId}-`
    : null

  const cursor = new Date(rangeStart)
  cursor.setHours(0, 0, 0, 0)

  while (cursor <= rangeEnd) {
    if (cursor.getDay() === dayIndex) {
      const dateKey = toDateParam(cursor)
      if (
        (!input.offeringStartDate || dateKey >= input.offeringStartDate) &&
        (!input.offeringEndDate || dateKey <= input.offeringEndDate)
      ) {
        const startAt = combineDateAndTime(cursor, input.startTime)
        let endAt = combineDateAndTime(cursor, input.endTime)
        if (endAt <= startAt) {
          endAt = new Date(startAt.getTime() + 60 * 60 * 1000)
        }

        const conflict = blocking.some((row) => {
          if (excludePrefix && row.id.startsWith(excludePrefix)) {
            return false
          }
          return rangesOverlap(
            startAt,
            endAt,
            new Date(row.startAt),
            new Date(row.endAt)
          )
        })

        if (conflict) {
          throw new Error(
            "That space and time is unavailable because another rental, event, program, or hold is already scheduled. Please choose a different time."
          )
        }
      }
    }

    cursor.setDate(cursor.getDate() + 1)
  }
}

function scheduleRowPayload(
  organizationId: string,
  input: ScheduleItemInput,
  dayOfWeek: string,
  extras: { is_recurring: boolean; recurring_group_id: string | null }
) {
  return {
    organization_id: organizationId,
    program_id: input.program_id,
    offering_id: input.offering_id,
    title: input.title,
    day_of_week: dayOfWeek,
    start_time: input.start_time,
    end_time: input.end_time,
    location: input.location || null,
    venue_id: input.venue_id || null,
    instructor_name: input.instructor_name || null,
    capacity: input.capacity || null,
    color: input.color || "bg-blue-500",
    is_recurring: extras.is_recurring,
    recurring_group_id: extras.recurring_group_id,
  }
}

export async function createScheduleItem(input: ScheduleItemInput) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  await assertCanManageProgram(input.program_id)

  if (!input.offering_id) {
    throw new Error("Offering is required for schedule items")
  }

  const offering = await assertOfferingBelongsToProgram(
    organizationId,
    input.program_id,
    input.offering_id
  )

  const conflicts = await checkInstructorConflicts({
    program_id: input.program_id,
    day_of_week: input.day_of_week,
    start_time: input.start_time,
    end_time: input.end_time,
    instructor_name: input.instructor_name,
  })

  if (conflicts.length > 0) {
    throw new Error(
      "Instructor conflict: this instructor is already scheduled at that time."
    )
  }

  await assertFacilityAvailabilityForSchedule({
    organizationId,
    venueId: input.venue_id,
    dayOfWeek: input.day_of_week,
    startTime: input.start_time,
    endTime: input.end_time,
    offeringStartDate: offering.start_date,
    offeringEndDate: offering.end_date,
  })

  const row = scheduleRowPayload(organizationId, input, input.day_of_week, {
    is_recurring: false,
    recurring_group_id: null,
  })

  const { error } = await supabase.from("program_schedule_items").insert(row)

  if (error) {
    if (error.message?.includes("venue_id") || error.code === "42703") {
      const { venue_id: _venueId, ...withoutVenue } = row
      const { error: fallbackError } = await supabase
        .from("program_schedule_items")
        .insert(withoutVenue)
      if (fallbackError) {
        console.error(fallbackError)
        throw new Error("Failed to create schedule item")
      }
    } else {
      console.error(error)
      throw new Error("Failed to create schedule item")
    }
  }

  await syncOperationalBriefForProgram(input.program_id, organizationId)

  revalidateSchedulePaths(input.program_id, input.offering_id)
}

export async function createRecurringScheduleItems(
  input: CreateRecurringScheduleInput
) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  await assertCanManageProgram(input.program_id)

  if (!input.offering_id) {
    throw new Error("Offering is required for schedule items")
  }

  if (!input.days_of_week.length) {
    throw new Error("At least one day is required")
  }

  const offering = await assertOfferingBelongsToProgram(
    organizationId,
    input.program_id,
    input.offering_id
  )

  for (const day of input.days_of_week) {
    const conflicts = await checkInstructorConflicts({
      program_id: input.program_id,
      day_of_week: day,
      start_time: input.start_time,
      end_time: input.end_time,
      instructor_name: input.instructor_name,
    })

    if (conflicts.length > 0) {
      throw new Error(
        `Instructor conflict on ${day}: this instructor is already scheduled at that time.`
      )
    }

    await assertFacilityAvailabilityForSchedule({
      organizationId,
      venueId: input.venue_id,
      dayOfWeek: day,
      startTime: input.start_time,
      endTime: input.end_time,
      offeringStartDate: offering.start_date,
      offeringEndDate: offering.end_date,
    })
  }

  const recurringGroupId = randomUUID()

  const rows = input.days_of_week.map((day) =>
    scheduleRowPayload(organizationId, input, day, {
      is_recurring: true,
      recurring_group_id: recurringGroupId,
    })
  )

  const { error } = await supabase.from("program_schedule_items").insert(rows)

  if (error) {
    if (error.message?.includes("venue_id") || error.code === "42703") {
      const fallbackRows = rows.map(({ venue_id: _venueId, ...rest }) => rest)
      const { error: fallbackError } = await supabase
        .from("program_schedule_items")
        .insert(fallbackRows)
      if (fallbackError) {
        console.error(fallbackError)
        throw new Error("Failed to create recurring schedule items")
      }
    } else {
      console.error(error)
      throw new Error("Failed to create recurring schedule items")
    }
  }

  await syncOperationalBriefForProgram(input.program_id, organizationId)

  revalidateSchedulePaths(input.program_id, input.offering_id)
}

/**
 * Replace all weekly meeting times for an offering with one recurring pattern
 * (same start/end time across selected days). Used by the simple schedule editor.
 */
export async function replaceOfferingWeeklySchedule(input: {
  program_id: string
  offering_id: string
  title?: string
  days_of_week: string[]
  start_time: string
  end_time: string
  location?: string
  venue_id?: string | null
  instructor_name?: string
}) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  await assertCanManageProgram(input.program_id)

  if (!input.offering_id) {
    throw new Error("Offering is required for schedule items")
  }

  if (!input.days_of_week.length) {
    throw new Error("Select at least one day.")
  }

  if (!input.start_time || !input.end_time) {
    throw new Error("Start and end time are required.")
  }

  const { error: deleteError } = await supabase
    .from("program_schedule_items")
    .delete()
    .eq("organization_id", organizationId)
    .eq("program_id", input.program_id)
    .eq("offering_id", input.offering_id)

  if (deleteError) {
    console.error(deleteError)
    throw new Error("Failed to clear existing schedule times.")
  }

  await createRecurringScheduleItems({
    program_id: input.program_id,
    offering_id: input.offering_id,
    title: input.title?.trim() || "Weekly time",
    days_of_week: input.days_of_week,
    start_time: input.start_time,
    end_time: input.end_time,
    location: input.location,
    venue_id: input.venue_id ?? null,
    instructor_name: input.instructor_name,
  })
}

/** Clear all schedule items for an offering (simple editor with no days selected). */
export async function clearOfferingWeeklySchedule(input: {
  program_id: string
  offering_id: string
}) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  await assertCanManageProgram(input.program_id)

  const { error } = await supabase
    .from("program_schedule_items")
    .delete()
    .eq("organization_id", organizationId)
    .eq("program_id", input.program_id)
    .eq("offering_id", input.offering_id)

  if (error) {
    console.error(error)
    throw new Error("Failed to clear schedule times.")
  }

  await syncOperationalBriefForProgram(input.program_id, organizationId)
  revalidateSchedulePaths(input.program_id, input.offering_id)
}

export async function updateScheduleItem(
  itemId: string,
  input: ScheduleItemInput
) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  await assertCanManageProgram(input.program_id)

  if (!input.offering_id) {
    throw new Error("Offering is required for schedule items")
  }

  const offering = await assertOfferingBelongsToProgram(
    organizationId,
    input.program_id,
    input.offering_id
  )

  const conflicts = await checkInstructorConflicts({
    program_id: input.program_id,
    day_of_week: input.day_of_week,
    start_time: input.start_time,
    end_time: input.end_time,
    instructor_name: input.instructor_name,
    exclude_item_id: itemId,
  })

  if (conflicts.length > 0) {
    throw new Error(
      "Instructor conflict: this instructor is already scheduled at that time."
    )
  }

  await assertFacilityAvailabilityForSchedule({
    organizationId,
    venueId: input.venue_id,
    dayOfWeek: input.day_of_week,
    startTime: input.start_time,
    endTime: input.end_time,
    offeringStartDate: offering.start_date,
    offeringEndDate: offering.end_date,
    excludeScheduleItemId: itemId,
  })

  const { error } = await supabase
    .from("program_schedule_items")
    .update({
      title: input.title,
      day_of_week: input.day_of_week,
      start_time: input.start_time,
      end_time: input.end_time,
      location: input.location || null,
      venue_id: input.venue_id || null,
      instructor_name: input.instructor_name || null,
      capacity: input.capacity || null,
      color: input.color || "bg-blue-500",
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("organization_id", organizationId)
    .eq("program_id", input.program_id)
    .eq("offering_id", input.offering_id)

  if (error) {
    if (error.message?.includes("venue_id") || error.code === "42703") {
      const { error: fallbackError } = await supabase
        .from("program_schedule_items")
        .update({
          title: input.title,
          day_of_week: input.day_of_week,
          start_time: input.start_time,
          end_time: input.end_time,
          location: input.location || null,
          instructor_name: input.instructor_name || null,
          capacity: input.capacity || null,
          color: input.color || "bg-blue-500",
          updated_at: new Date().toISOString(),
        })
        .eq("id", itemId)
        .eq("organization_id", organizationId)
        .eq("program_id", input.program_id)
        .eq("offering_id", input.offering_id)
      if (fallbackError) {
        console.error(fallbackError)
        throw new Error("Failed to update schedule item")
      }
    } else {
      console.error(error)
      throw new Error("Failed to update schedule item")
    }
  }

  await syncOperationalBriefForProgram(input.program_id, organizationId)

  revalidateSchedulePaths(input.program_id, input.offering_id)
}

export async function deleteScheduleItem(
  itemId: string,
  programId: string,
  offeringId: string
) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  await assertCanManageProgram(programId)

  const { error } = await supabase
    .from("program_schedule_items")
    .delete()
    .eq("id", itemId)
    .eq("organization_id", organizationId)
    .eq("program_id", programId)
    .eq("offering_id", offeringId)

  if (error) {
    console.error(error)
    throw new Error("Failed to delete schedule item")
  }

  await syncOperationalBriefForProgram(programId, organizationId)

  revalidateSchedulePaths(programId, offeringId)
}

export async function copyOfferingScheduleItems(input: {
  organizationId: string
  programId: string
  sourceOfferingId: string
  targetOfferingId: string
}) {
  await assertCanManageProgram(input.programId)
  const supabase = await createClient()

  const { data: sourceItems, error } = await supabase
    .from("program_schedule_items")
    .select(
      "title, day_of_week, start_time, end_time, location, venue_id, instructor_name, capacity, color, is_recurring, recurring_group_id"
    )
    .eq("organization_id", input.organizationId)
    .eq("offering_id", input.sourceOfferingId)

  if (error) {
    if (error.message?.includes("venue_id") || error.code === "42703") {
      const fallback = await supabase
        .from("program_schedule_items")
        .select(
          "title, day_of_week, start_time, end_time, location, instructor_name, capacity, color, is_recurring, recurring_group_id"
        )
        .eq("organization_id", input.organizationId)
        .eq("offering_id", input.sourceOfferingId)
      if (fallback.error) throw new Error(fallback.error.message)
      await copyOfferingScheduleItemsWithoutVenue({
        ...input,
        sourceItems: fallback.data || [],
      })
      return
    }
    throw new Error(error.message)
  }

  if (!sourceItems || sourceItems.length === 0) {
    return
  }

  const groupIdMap = new Map<string, string>()

  const rows = sourceItems.map((item) => {
    let recurringGroupId = item.recurring_group_id as string | null
    if (item.is_recurring && recurringGroupId) {
      if (!groupIdMap.has(recurringGroupId)) {
        groupIdMap.set(recurringGroupId, randomUUID())
      }
      recurringGroupId = groupIdMap.get(recurringGroupId) || null
    } else {
      recurringGroupId = null
    }

    return {
      organization_id: input.organizationId,
      program_id: input.programId,
      offering_id: input.targetOfferingId,
      title: item.title,
      day_of_week: item.day_of_week,
      start_time: item.start_time,
      end_time: item.end_time,
      location: item.location,
      venue_id: (item as { venue_id?: string | null }).venue_id ?? null,
      instructor_name: item.instructor_name,
      capacity: item.capacity,
      color: item.color || "bg-blue-500",
      is_recurring: Boolean(item.is_recurring),
      recurring_group_id: recurringGroupId,
    }
  })

  const { error: insertError } = await supabase
    .from("program_schedule_items")
    .insert(rows)

  if (insertError) {
    throw new Error(insertError.message)
  }

  revalidateSchedulePaths(input.programId, input.targetOfferingId)
}

async function copyOfferingScheduleItemsWithoutVenue(input: {
  organizationId: string
  programId: string
  sourceOfferingId: string
  targetOfferingId: string
  sourceItems: Array<Record<string, unknown>>
}) {
  const supabase = await createClient()
  const groupIdMap = new Map<string, string>()

  const rows = input.sourceItems.map((item) => {
    let recurringGroupId = item.recurring_group_id as string | null
    if (item.is_recurring && recurringGroupId) {
      if (!groupIdMap.has(recurringGroupId)) {
        groupIdMap.set(recurringGroupId, randomUUID())
      }
      recurringGroupId = groupIdMap.get(recurringGroupId) || null
    } else {
      recurringGroupId = null
    }

    return {
      organization_id: input.organizationId,
      program_id: input.programId,
      offering_id: input.targetOfferingId,
      title: item.title,
      day_of_week: item.day_of_week,
      start_time: item.start_time,
      end_time: item.end_time,
      location: item.location,
      instructor_name: item.instructor_name,
      capacity: item.capacity,
      color: (item.color as string) || "bg-blue-500",
      is_recurring: Boolean(item.is_recurring),
      recurring_group_id: recurringGroupId,
    }
  })

  const { error: insertError } = await supabase
    .from("program_schedule_items")
    .insert(rows)

  if (insertError) {
    throw new Error(insertError.message)
  }

  revalidateSchedulePaths(input.programId, input.targetOfferingId)
}

/** Resolve offering manage URL for /programs/schedule?program= redirects. */
export async function resolveProgramScheduleRedirect(
  programId: string
): Promise<string | null> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId || !programId) return null

  const supabase = await createClient()

  const [{ data: program }, { data: offerings }] = await Promise.all([
    supabase
      .from("programs")
      .select("department_id")
      .eq("id", programId)
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase
      .from("program_offerings")
      .select("id, is_default, status")
      .eq("organization_id", organizationId)
      .eq("program_id", programId)
      .neq("status", "archived")
      .order("is_default", { ascending: false })
      .order("name", { ascending: true }),
  ])

  const offering = (offerings || [])[0]
  if (!offering?.id) {
    return `/programs/${programId}`
  }

  return programOfferingManageHref(programId, offering.id as string, {
    departmentId: (program?.department_id as string | null) ?? null,
  })
}
