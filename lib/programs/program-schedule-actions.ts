"use server"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"

import { syncOperationalBriefForProgram } from "@/lib/operational-briefs/operational-brief-queries"
import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { getInstructorScheduleConflicts } from "@/lib/programs/program-schedule-queries"

type ScheduleItemInput = {
  program_id: string
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

  revalidatePath(`/programs/${input.program_id}`)
  revalidatePath("/facilities/calendar")
  revalidatePath("/facilities/availability")
  revalidatePath("/facilities/reservation-center")
}

export async function createRecurringScheduleItems(
  input: CreateRecurringScheduleInput
) {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  if (!input.days_of_week.length) {
    throw new Error("At least one day is required")
  }

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

  revalidatePath(`/programs/${input.program_id}`)
  revalidatePath("/facilities/calendar")
  revalidatePath("/facilities/availability")
  revalidatePath("/facilities/reservation-center")
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
    })
    .eq("id", itemId)
    .eq("organization_id", organizationId)
    .eq("program_id", input.program_id)

  if (error) {
    console.error(error)
    throw new Error("Failed to update schedule item")
  }

  await syncOperationalBriefForProgram(input.program_id, organizationId)

  revalidatePath(`/programs/${input.program_id}`)
  revalidatePath("/facilities/calendar")
  revalidatePath("/facilities/availability")
  revalidatePath("/facilities/reservation-center")
}

export async function deleteScheduleItem(itemId: string, programId: string) {
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

  if (error) {
    console.error(error)
    throw new Error("Failed to delete schedule item")
  }

  await syncOperationalBriefForProgram(programId, organizationId)

  revalidatePath(`/programs/${programId}`)
  revalidatePath("/facilities/calendar")
  revalidatePath("/facilities/availability")
  revalidatePath("/facilities/reservation-center")
}