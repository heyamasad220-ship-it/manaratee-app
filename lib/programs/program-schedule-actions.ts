"use server"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"

import { syncOperationalBriefForProgram } from "@/lib/operational-briefs/operational-brief-queries"
import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { programOfferingManageHref } from "@/lib/programs/program-offering-paths"
import { getInstructorScheduleConflicts } from "@/lib/programs/program-schedule-queries"

type ScheduleItemInput = {
  program_id: string
  offering_id: string
  title: string
  day_of_week: string
  start_time: string
  end_time: string
  location?: string
  instructor_name?: string
  capacity?: number
  color?: string
}

type CreateRecurringScheduleInput = Omit<ScheduleItemInput, "day_of_week"> & {
  days_of_week: string[]
}

function revalidateSchedulePaths(programId: string, offeringId: string) {
  revalidatePath(`/programs/${programId}`)
  revalidatePath(`/programs/${programId}/offerings`)
  revalidatePath(programOfferingManageHref(programId, offeringId, "enrollment"))
  revalidatePath(`/customer/programs/${programId}`)
  revalidatePath("/programs/schedule")
  revalidatePath("/facilities/calendar")
  revalidatePath("/facilities/availability")
  revalidatePath("/facilities/reservation-center")
}

async function assertOfferingBelongsToProgram(
  organizationId: string,
  programId: string,
  offeringId: string
) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("program_offerings")
    .select("id")
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

export async function createScheduleItem(input: ScheduleItemInput) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  if (!input.offering_id) {
    throw new Error("Offering is required for schedule items")
  }

  await assertOfferingBelongsToProgram(
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

  const { error } = await supabase.from("program_schedule_items").insert({
    organization_id: organizationId,
    program_id: input.program_id,
    offering_id: input.offering_id,
    title: input.title,
    day_of_week: input.day_of_week,
    start_time: input.start_time,
    end_time: input.end_time,
    location: input.location || null,
    instructor_name: input.instructor_name || null,
    capacity: input.capacity || null,
    color: input.color || "bg-blue-500",
    is_recurring: false,
    recurring_group_id: null,
  })

  if (error) {
    console.error(error)
    throw new Error("Failed to create schedule item")
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

  if (!input.offering_id) {
    throw new Error("Offering is required for schedule items")
  }

  if (!input.days_of_week.length) {
    throw new Error("At least one day is required")
  }

  await assertOfferingBelongsToProgram(
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
  }

  const recurringGroupId = randomUUID()

  const rows = input.days_of_week.map((day) => ({
    organization_id: organizationId,
    program_id: input.program_id,
    offering_id: input.offering_id,
    title: input.title,
    day_of_week: day,
    start_time: input.start_time,
    end_time: input.end_time,
    location: input.location || null,
    instructor_name: input.instructor_name || null,
    capacity: input.capacity || null,
    color: input.color || "bg-blue-500",
    is_recurring: true,
    recurring_group_id: recurringGroupId,
  }))

  const { error } = await supabase.from("program_schedule_items").insert(rows)

  if (error) {
    console.error(error)
    throw new Error("Failed to create recurring schedule items")
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

  if (!input.offering_id) {
    throw new Error("Offering is required for schedule items")
  }

  await assertOfferingBelongsToProgram(
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

  const { error } = await supabase
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

  if (error) {
    console.error(error)
    throw new Error("Failed to update schedule item")
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
  const supabase = await createClient()

  const { data: sourceItems, error } = await supabase
    .from("program_schedule_items")
    .select(
      "title, day_of_week, start_time, end_time, location, instructor_name, capacity, color, is_recurring, recurring_group_id"
    )
    .eq("organization_id", input.organizationId)
    .eq("offering_id", input.sourceOfferingId)

  if (error) {
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

/** Resolve offering Schedule tab for /programs/schedule?program= redirects. */
export async function resolveProgramScheduleRedirect(
  programId: string
): Promise<string | null> {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId || !programId) return null

  const supabase = await createClient()

  const { data: offerings } = await supabase
    .from("program_offerings")
    .select("id, is_default, status")
    .eq("organization_id", organizationId)
    .eq("program_id", programId)
    .neq("status", "archived")
    .order("is_default", { ascending: false })
    .order("name", { ascending: true })

  const offering = (offerings || [])[0]
  if (!offering?.id) {
    return `/programs/${programId}`
  }

  return programOfferingManageHref(programId, offering.id as string, "enrollment")
}
