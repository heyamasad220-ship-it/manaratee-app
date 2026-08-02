"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { resolveOrganizationId } from "@/lib/organizations/resolve-organization-id"
import { hasAnyPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import type {
  VenueRentalApprovalMode,
  VenueRentalOrgSettings,
} from "@/lib/bookings/venue-rental-types"
import { getVenueRentalOrgSettings } from "@/lib/bookings/venue-rental-queries"
import { clampBufferMinutes } from "@/lib/bookings/venue-rental-buffers"

async function assertCanManageVenueRentalSettings() {
  const canManage = await hasAnyPermission(
    PERMISSIONS.BOOKINGS_MANAGE,
    PERMISSIONS.PROGRAMS_MANAGE
  )
  if (!canManage) {
    throw new Error("You do not have permission to manage venue rental settings.")
  }
}

function revalidateSettingsPaths() {
  revalidatePath("/bookings/settings/general")
  revalidatePath("/bookings/settings/policies")
  revalidatePath("/bookings/rentals")
  revalidatePath("/bookings/requests")
  revalidatePath("/bookings/payments")
  revalidatePath("/customer/rentals")
}

function normalizeOptionalUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim() || ""
  return trimmed || null
}

function normalizeOptionalName(value: string | null | undefined): string | null {
  const trimmed = value?.trim() || ""
  return trimmed || null
}

export async function updateVenueRentalOrgSettings(input: {
  securityDepositEnabled: boolean
  defaultSecurityDepositAmount?: number | null
  policiesDocumentUrl?: string | null
  policiesDocumentName?: string | null
  pricingGuideUrl?: string | null
  pricingGuideName?: string | null
  approvalMode?: VenueRentalApprovalMode
  defaultSetupMinutes?: number | null
  defaultCleanupMinutes?: number | null
}): Promise<VenueRentalOrgSettings> {
  await assertCanManageVenueRentalSettings()

  const supabase = await createClient()
  const organizationId = await resolveOrganizationId()
  if (!organizationId) {
    throw new Error("No organization selected")
  }

  const enabled = Boolean(input.securityDepositEnabled)
  let defaultAmount: number | null = null

  if (enabled) {
    const raw = Number(input.defaultSecurityDepositAmount)
    if (Number.isFinite(raw) && raw > 0) {
      defaultAmount = Math.round(raw * 100) / 100
    } else if (
      input.defaultSecurityDepositAmount != null &&
      String(input.defaultSecurityDepositAmount).trim() !== "" &&
      !(Number.isFinite(raw) && raw === 0)
    ) {
      throw new Error("Enter a valid default security deposit amount of $0 or more.")
    } else if (Number.isFinite(raw) && raw === 0) {
      defaultAmount = 0
    }
  }

  const approvalMode: VenueRentalApprovalMode =
    input.approvalMode === "auto_after_agreement"
      ? "auto_after_agreement"
      : "manual"

  const policiesDocumentUrl = normalizeOptionalUrl(input.policiesDocumentUrl)
  const pricingGuideUrl = normalizeOptionalUrl(input.pricingGuideUrl)

  if (approvalMode === "auto_after_agreement" && !policiesDocumentUrl && !pricingGuideUrl) {
    throw new Error(
      "Upload at least one customer document before enabling auto-approve after agreement."
    )
  }

  const defaultSetupMinutes = clampBufferMinutes(input.defaultSetupMinutes)
  const defaultCleanupMinutes = clampBufferMinutes(input.defaultCleanupMinutes)

  const { error } = await supabase.from("venue_rental_settings").upsert(
    {
      organization_id: organizationId,
      security_deposit_enabled: enabled,
      default_security_deposit_amount: enabled ? defaultAmount : null,
      policies_document_url: policiesDocumentUrl,
      policies_document_name: policiesDocumentUrl
        ? normalizeOptionalName(input.policiesDocumentName) || "Policies & procedures"
        : null,
      pricing_guide_url: pricingGuideUrl,
      pricing_guide_name: pricingGuideUrl
        ? normalizeOptionalName(input.pricingGuideName) || "Pricing guide"
        : null,
      approval_mode: approvalMode,
      default_setup_minutes: defaultSetupMinutes,
      default_cleanup_minutes: defaultCleanupMinutes,
    },
    { onConflict: "organization_id" }
  )

  if (error) {
    if (
      error.message?.toLowerCase().includes("venue_rental_settings") ||
      error.code === "42P01"
    ) {
      throw new Error(
        "Venue rental settings table is missing. Run scripts/220_venue_rental_org_settings.sql in Supabase."
      )
    }
    if (
      error.code === "42703" ||
      error.message?.toLowerCase().includes("policies_document") ||
      error.message?.toLowerCase().includes("approval_mode")
    ) {
      throw new Error(
        "Customer document settings columns are missing. Run scripts/221_venue_rental_customer_documents.sql in Supabase."
      )
    }
    if (
      error.code === "42703" ||
      error.message?.toLowerCase().includes("default_setup_minutes") ||
      error.message?.toLowerCase().includes("default_cleanup_minutes")
    ) {
      throw new Error(
        "Setup/cleanup buffer columns are missing. Run scripts/222_venue_rental_setup_cleanup_buffers.sql in Supabase."
      )
    }
    throw new Error(error.message || "Failed to save settings.")
  }

  revalidateSettingsPaths()
  return getVenueRentalOrgSettings()
}
