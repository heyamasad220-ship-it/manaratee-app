import type { SupabaseClient } from "@supabase/supabase-js"

import { parseServiceRequirements } from "@/lib/events/event-service-requirements"
import type { ServiceParticipationSourceType } from "./service-participation-types"

function sumChildcareCapacity(serviceRequirements: unknown): number {
  const config = parseServiceRequirements(serviceRequirements)
  const groups = config.childcare?.ageGroups || []

  if (groups.length > 0) {
    return groups.reduce((total, group) => total + (group.capacity || 0), 0)
  }

  if (config.childcare?.capacity) {
    return config.childcare.capacity
  }

  return 20
}

function toDateString(value: string | null | undefined): string {
  if (!value) {
    return new Date().toISOString().slice(0, 10)
  }

  return value.slice(0, 10)
}

function toTimeString(value: string | null | undefined): string | null {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

export async function ensureChildcareEventForSource(
  supabase: SupabaseClient,
  input: {
    organizationId: string
    sourceType: ServiceParticipationSourceType
    sourceId: string
  }
): Promise<string> {
  const { data: existing, error: existingError } = await supabase
    .from("childcare_events")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("source_type", input.sourceType)
    .eq("source_id", input.sourceId)
    .maybeSingle()

  if (existingError && existingError.code !== "42P01") {
    throw new Error(existingError.message)
  }

  if (existing?.id) {
    return existing.id as string
  }

  if (input.sourceType === "internal_event") {
    const { data: event, error } = await supabase
      .from("internal_events")
      .select("name, start_at, end_at, service_requirements")
      .eq("organization_id", input.organizationId)
      .eq("id", input.sourceId)
      .maybeSingle()

    if (error || !event) {
      throw new Error("Event not found.")
    }

    const { data: created, error: createError } = await supabase
      .from("childcare_events")
      .insert({
        organization_id: input.organizationId,
        name: `${event.name} — Childcare`,
        event_date: toDateString(event.start_at as string | null),
        start_time: toTimeString(event.start_at as string | null),
        end_time: toTimeString(event.end_at as string | null),
        capacity: sumChildcareCapacity(event.service_requirements),
        source_type: input.sourceType,
        source_id: input.sourceId,
        service_requirements: event.service_requirements || {},
        is_active: true,
      })
      .select("id")
      .single()

    if (createError) {
      throw new Error(createError.message)
    }

    return created.id as string
  }

  const { data: program, error: programError } = await supabase
    .from("programs")
    .select("name, start_date, end_date, service_requirements")
    .eq("organization_id", input.organizationId)
    .eq("id", input.sourceId)
    .maybeSingle()

  if (programError || !program) {
    throw new Error("Program not found.")
  }

  const { data: created, error: createError } = await supabase
    .from("childcare_events")
    .insert({
      organization_id: input.organizationId,
      name: `${program.name} — Childcare`,
      event_date: toDateString(program.start_date as string | null),
      start_time: null,
      end_time: null,
      capacity: sumChildcareCapacity(program.service_requirements),
      source_type: input.sourceType,
      source_id: input.sourceId,
      service_requirements: program.service_requirements || {},
      is_active: true,
    })
    .select("id")
    .single()

  if (createError) {
    throw new Error(createError.message)
  }

  return created.id as string
}
