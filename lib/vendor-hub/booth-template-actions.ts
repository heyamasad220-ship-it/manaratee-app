"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import type {
  VendorHubBoothSetupTemplate,
  VendorHubBoothSetupTemplateLine,
  VendorHubBoothSetupTemplateWithLines,
} from "@/lib/vendor-hub/booth-catalog-types"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
}

async function assertCanManageVendorHubBooths() {
  const canManage = await hasAnyPermission(
    PERMISSIONS.VENDOR_HUB_MANAGE,
    PERMISSIONS.EVENTS_MANAGE
  )
  if (!canManage) {
    throw new Error("You do not have permission to manage booth settings.")
  }
}

function mapTemplateRow(row: Record<string, unknown>): VendorHubBoothSetupTemplate {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    name: row.name as string,
    slug: row.slug as string,
    description: (row.description as string | null) ?? null,
    is_active: row.is_active as boolean,
    sort_order: row.sort_order as number,
  }
}

function mapTemplateLineRow(row: Record<string, unknown>): VendorHubBoothSetupTemplateLine {
  const rawSlugs = row.attribute_slugs
  const attributeSlugs = Array.isArray(rawSlugs)
    ? rawSlugs.filter((value): value is string => typeof value === "string")
    : []

  return {
    id: row.id as string,
    template_id: row.template_id as string,
    line_name: row.line_name as string,
    size: (row.size as string | null) ?? null,
    price: row.price === null || row.price === undefined ? null : Number(row.price),
    color: (row.color as string | null) ?? null,
    quantity: Number(row.quantity ?? 1),
    capacity: row.capacity === null || row.capacity === undefined ? null : Number(row.capacity),
    location: (row.location as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    sort_order: Number(row.sort_order ?? 0),
    attribute_slugs: attributeSlugs,
  }
}

export async function fetchBoothSetupTemplates(): Promise<VendorHubBoothSetupTemplateWithLines[]> {
  await assertCanManageVendorHubBooths()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return []
  }

  const { data: templates, error: templateError } = await supabase
    .from("vendor_hub_booth_setup_templates")
    .select("*")
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  if (templateError) {
    if (templateError.code === "42P01") {
      return []
    }
    console.error("fetchBoothSetupTemplates:", templateError)
    throw new Error("Failed to load booth templates.")
  }

  if (!templates?.length) {
    return []
  }

  const templateIds = templates.map((row) => row.id as string)
  const { data: lines, error: lineError } = await supabase
    .from("vendor_hub_booth_setup_template_lines")
    .select("*")
    .in("template_id", templateIds)
    .order("sort_order", { ascending: true })

  if (lineError) {
    console.error("fetchBoothSetupTemplates lines:", lineError)
    throw new Error("Failed to load booth template lines.")
  }

  const linesByTemplate = new Map<string, VendorHubBoothSetupTemplateLine[]>()
  for (const row of lines ?? []) {
    const line = mapTemplateLineRow(row)
    const existing = linesByTemplate.get(line.template_id) ?? []
    existing.push(line)
    linesByTemplate.set(line.template_id, existing)
  }

  return templates.map((row) => ({
    ...mapTemplateRow(row),
    lines: linesByTemplate.get(row.id as string) ?? [],
  }))
}

export async function fetchActiveBoothSetupTemplatesForPicker(): Promise<
  VendorHubBoothSetupTemplate[]
> {
  const templates = await fetchBoothSetupTemplates()
  return templates.filter((template) => template.is_active)
}

export type BoothSetupTemplateLineInput = {
  id?: string
  line_name: string
  size?: string | null
  price?: number | null
  color?: string | null
  quantity: number
  capacity?: number | null
  location?: string | null
  description?: string | null
  sort_order?: number
  attribute_slugs?: string[]
}

export type UpsertBoothSetupTemplateInput = {
  id?: string
  name: string
  description?: string | null
  is_active?: boolean
  sort_order?: number
  lines: BoothSetupTemplateLineInput[]
}

export async function upsertBoothSetupTemplate(input: UpsertBoothSetupTemplateInput) {
  await assertCanManageVendorHubBooths()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const name = input.name.trim()
  if (!name) {
    throw new Error("Template name is required.")
  }

  if (input.lines.length === 0) {
    throw new Error("Add at least one booth line to the template.")
  }

  const slug = slugify(name)
  if (!slug) {
    throw new Error("Template name must contain letters or numbers.")
  }

  let templateId = input.id

  if (templateId) {
    const { error } = await supabase
      .from("vendor_hub_booth_setup_templates")
      .update({
        name,
        description: input.description?.trim() || null,
        is_active: input.is_active ?? true,
        sort_order: input.sort_order ?? 0,
      })
      .eq("id", templateId)
      .eq("organization_id", organizationId)

    if (error) {
      console.error(error)
      throw new Error("Failed to update booth template.")
    }
  } else {
    const { data, error } = await supabase
      .from("vendor_hub_booth_setup_templates")
      .insert({
        organization_id: organizationId,
        name,
        slug,
        description: input.description?.trim() || null,
        is_active: input.is_active ?? true,
        sort_order: input.sort_order ?? 0,
      })
      .select("id")
      .single()

    if (error) {
      console.error(error)
      if (error.code === "23505") {
        throw new Error("A template with this name already exists.")
      }
      throw new Error("Failed to create booth template.")
    }

    templateId = data.id
  }

  await supabase
    .from("vendor_hub_booth_setup_template_lines")
    .delete()
    .eq("template_id", templateId)

  const lineRows = input.lines.map((line, index) => ({
    template_id: templateId,
    line_name: line.line_name.trim(),
    size: line.size?.trim() || null,
    price: line.price ?? 0,
    color: line.color || "#2563eb",
    quantity: Math.max(1, line.quantity),
    capacity: line.capacity ?? 0,
    location: line.location?.trim() || null,
    description: line.description?.trim() || null,
    sort_order: line.sort_order ?? index,
    attribute_slugs: line.attribute_slugs ?? [],
  }))

  const { error: lineInsertError } = await supabase
    .from("vendor_hub_booth_setup_template_lines")
    .insert(lineRows)

  if (lineInsertError) {
    console.error(lineInsertError)
    throw new Error("Failed to save booth template lines.")
  }

  revalidatePath(VENDOR_HUB_ROUTES.settings)
}

export async function deleteBoothSetupTemplate(id: string) {
  await assertCanManageVendorHubBooths()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase
    .from("vendor_hub_booth_setup_templates")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId)

  if (error) {
    console.error(error)
    throw new Error("Failed to delete booth template.")
  }

  revalidatePath(VENDOR_HUB_ROUTES.settings)
}

function boothNumberPrefix(lineName: string, sortOrder: number) {
  const slug = slugify(lineName)
  if (slug.length >= 3) {
    return slug.slice(0, 4).toUpperCase()
  }
  return `B${sortOrder + 1}`
}

export async function saveEventBoothSetupAsTemplate(input: {
  eventId: string
  name: string
  description?: string | null
}) {
  await assertCanManageVendorHubBooths()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { data: boothTypes, error: typeError } = await supabase
    .from("vendor_hub_booth_types")
    .select("id, name, size, price, color, capacity, location, description, sort_order")
    .eq("event_id", input.eventId)
    .order("sort_order", { ascending: true })

  if (typeError) {
    throw new Error("Failed to read booth types for this event.")
  }

  if (!boothTypes?.length) {
    throw new Error("This event has no booth types to save as a template.")
  }

  const typeIds = boothTypes.map((row) => row.id as string)

  const [{ data: boothCounts }, { data: typeAttributeLinks }] = await Promise.all([
    supabase.from("vendor_hub_booths").select("booth_type_id").eq("event_id", input.eventId),
    supabase
      .from("vendor_hub_booth_type_attributes")
      .select("booth_type_id, attribute_id")
      .in("booth_type_id", typeIds),
  ])

  const attributeIds = [
    ...new Set((typeAttributeLinks ?? []).map((row) => row.attribute_id as string)),
  ]

  const { data: attributeRows } =
    attributeIds.length > 0
      ? await supabase
          .from("vendor_hub_booth_attributes")
          .select("id, slug")
          .in("id", attributeIds)
          .eq("organization_id", organizationId)
      : { data: [] as { id: string; slug: string }[] }

  const slugByAttributeId = new Map(
    (attributeRows ?? []).map((row) => [row.id as string, row.slug as string])
  )

  const countByType = new Map<string, number>()
  for (const booth of boothCounts ?? []) {
    const typeId = booth.booth_type_id as string | null
    if (!typeId) continue
    countByType.set(typeId, (countByType.get(typeId) ?? 0) + 1)
  }

  const slugsByType = new Map<string, string[]>()
  for (const row of typeAttributeLinks ?? []) {
    const typeId = row.booth_type_id as string
    const slug = slugByAttributeId.get(row.attribute_id as string)
    if (!slug) continue
    const existing = slugsByType.get(typeId) ?? []
    existing.push(slug)
    slugsByType.set(typeId, existing)
  }

  const lines: BoothSetupTemplateLineInput[] = boothTypes.map((type, index) => ({
    line_name: type.name as string,
    size: (type.size as string | null) ?? null,
    price: type.price === null ? null : Number(type.price),
    color: (type.color as string | null) ?? "#2563eb",
    quantity: countByType.get(type.id as string) ?? (Number(type.capacity ?? 1) || 1),
    capacity: type.capacity === null ? null : Number(type.capacity),
    location: (type.location as string | null) ?? null,
    description: (type.description as string | null) ?? null,
    sort_order: Number(type.sort_order ?? index),
    attribute_slugs: slugsByType.get(type.id as string) ?? [],
  }))

  await upsertBoothSetupTemplate({
    name: input.name,
    description: input.description,
    lines,
  })
}

export async function applyBoothSetupTemplate(input: {
  eventId: string
  templateId: string
  generateBoothInventory?: boolean
}) {
  await assertCanManageVendorHubBooths()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { data: template, error: templateError } = await supabase
    .from("vendor_hub_booth_setup_templates")
    .select("id, name")
    .eq("id", input.templateId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (templateError || !template) {
    throw new Error("Booth template not found.")
  }

  const { data: lines, error: lineError } = await supabase
    .from("vendor_hub_booth_setup_template_lines")
    .select("*")
    .eq("template_id", input.templateId)
    .order("sort_order", { ascending: true })

  if (lineError || !lines?.length) {
    throw new Error("This template has no booth lines.")
  }

  const { data: attributes } = await supabase
    .from("vendor_hub_booth_attributes")
    .select("id, slug")
    .eq("organization_id", organizationId)
    .eq("is_active", true)

  const attributeIdBySlug = new Map((attributes ?? []).map((row) => [row.slug as string, row.id as string]))

  let totalBooths = 0
  const generateBoothInventory = input.generateBoothInventory ?? true

  for (const [index, line] of lines.entries()) {
    const mappedLine = mapTemplateLineRow(line)

    const { data: boothType, error: typeInsertError } = await supabase
      .from("vendor_hub_booth_types")
      .insert({
        event_id: input.eventId,
        name: mappedLine.line_name,
        size: mappedLine.size,
        price: mappedLine.price ?? 0,
        color: mappedLine.color ?? "#2563eb",
        description: mappedLine.description,
        capacity: mappedLine.capacity ?? mappedLine.quantity,
        location: mappedLine.location,
        is_active: true,
        sort_order: mappedLine.sort_order ?? index,
      })
      .select("id")
      .single()

    if (typeInsertError || !boothType) {
      console.error(typeInsertError)
      throw new Error(`Failed to create booth type "${mappedLine.line_name}".`)
    }

    const attributeIds = mappedLine.attribute_slugs
      .map((slug) => attributeIdBySlug.get(slug))
      .filter((id): id is string => Boolean(id))

    if (attributeIds.length > 0) {
      await supabase.from("vendor_hub_booth_type_attributes").insert(
        attributeIds.map((attributeId) => ({
          booth_type_id: boothType.id,
          attribute_id: attributeId,
        }))
      )
    }

    totalBooths += mappedLine.quantity

    if (!generateBoothInventory) {
      continue
    }

    const prefix = boothNumberPrefix(mappedLine.line_name, mappedLine.sort_order ?? index)
    const boothRows = Array.from({ length: mappedLine.quantity }, (_, boothIndex) => ({
      event_id: input.eventId,
      booth_type_id: boothType.id,
      number: `${prefix}-${String(boothIndex + 1).padStart(2, "0")}`,
      location: mappedLine.location,
      status: "available",
      vendor_name: null,
      notes: null,
    }))

    const { error: boothInsertError } = await supabase.from("vendor_hub_booths").insert(boothRows)

    if (boothInsertError) {
      console.error(boothInsertError)
      throw new Error(`Failed to create booths for "${mappedLine.line_name}".`)
    }
  }

  await supabase
    .from("vendor_hub_events")
    .update({ total_booths: totalBooths })
    .eq("id", input.eventId)

  revalidatePath(VENDOR_HUB_ROUTES.events.detail(input.eventId))
  revalidatePath(VENDOR_HUB_ROUTES.events.booths(input.eventId))
  revalidatePath(VENDOR_HUB_ROUTES.settings)

  return { totalBooths, lineCount: lines.length }
}
