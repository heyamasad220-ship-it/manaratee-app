"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import type { VenueRentalDiscountType } from "@/lib/bookings/venue-rental-types"

type UpsertVenueRentalDiscountPolicyInput = {
  id?: string
  name: string
  description?: string | null
  discountType: VenueRentalDiscountType
  amount: number
  requiresMultiVenue?: boolean
  minVenues?: number
  discountTagId?: string | null
  isActive?: boolean
  sortOrder?: number
}

async function assertCanManageVenueRentalDiscounts() {
  const canManage = await hasAnyPermission(
    PERMISSIONS.BOOKINGS_MANAGE,
    PERMISSIONS.PROGRAMS_MANAGE
  )

  if (!canManage) {
    throw new Error("You do not have permission to manage rental discounts.")
  }
}

function revalidateDiscountPaths() {
  revalidatePath("/bookings/settings/discounts")
  revalidatePath("/bookings/settings")
  revalidatePath("/bookings/payments")
  revalidatePath("/bookings/requests")
}

export async function upsertVenueRentalDiscountPolicy(
  input: UpsertVenueRentalDiscountPolicyInput
) {
  await assertCanManageVenueRentalDiscounts()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const name = input.name.trim()
  if (!name) {
    throw new Error("Discount name is required.")
  }

  const discountType = input.discountType
  if (discountType !== "fixed" && discountType !== "percent") {
    throw new Error("Choose a fixed amount or percentage discount.")
  }

  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Enter a valid discount amount of $0 or more.")
  }
  if (discountType === "percent" && amount > 100) {
    throw new Error("Percent discount cannot exceed 100%.")
  }

  const requiresMultiVenue = Boolean(input.requiresMultiVenue)
  const discountTagId = input.discountTagId?.trim() || null
  const minVenues = Math.max(2, Math.floor(Number(input.minVenues) || 2))

  if (!requiresMultiVenue && !discountTagId) {
    throw new Error(
      "Choose at least one condition: multi-venue booking and/or a contact discount tag."
    )
  }

  if (discountTagId) {
    const { data: tag, error: tagError } = await supabase
      .from("discount_tags")
      .select("id")
      .eq("id", discountTagId)
      .eq("organization_id", organizationId)
      .maybeSingle()

    if (tagError || !tag) {
      throw new Error("Selected discount tag was not found.")
    }
  }

  const payload = {
    organization_id: organizationId,
    name,
    description: input.description?.trim() || null,
    discount_type: discountType,
    amount: Math.round(amount * 100) / 100,
    requires_multi_venue: requiresMultiVenue,
    min_venues: minVenues,
    discount_tag_id: discountTagId,
    is_active: input.isActive ?? true,
    sort_order: input.sortOrder ?? 0,
  }

  if (input.id) {
    const { error } = await supabase
      .from("venue_rental_discount_policies")
      .update({
        name: payload.name,
        description: payload.description,
        discount_type: payload.discount_type,
        amount: payload.amount,
        requires_multi_venue: payload.requires_multi_venue,
        min_venues: payload.min_venues,
        discount_tag_id: payload.discount_tag_id,
        is_active: payload.is_active,
        sort_order: payload.sort_order,
      })
      .eq("id", input.id)
      .eq("organization_id", organizationId)

    if (error) {
      if (error.code === "23505") {
        throw new Error("A discount with this name already exists.")
      }
      throw new Error(error.message || "Failed to update discount")
    }
  } else {
    const { error } = await supabase
      .from("venue_rental_discount_policies")
      .insert(payload)

    if (error) {
      if (error.code === "23505") {
        throw new Error("A discount with this name already exists.")
      }
      if (
        error.message?.toLowerCase().includes("venue_rental_discount_policies") ||
        error.code === "42P01"
      ) {
        throw new Error(
          "Discount policies table is missing. Run scripts/217_venue_rental_discount_policies.sql in Supabase."
        )
      }
      throw new Error(error.message || "Failed to create discount")
    }
  }

  revalidateDiscountPaths()
}

export async function deleteVenueRentalDiscountPolicy(policyId: string) {
  await assertCanManageVenueRentalDiscounts()

  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const { error } = await supabase
    .from("venue_rental_discount_policies")
    .delete()
    .eq("id", policyId)
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(error.message || "Failed to delete discount")
  }

  revalidateDiscountPaths()
}
