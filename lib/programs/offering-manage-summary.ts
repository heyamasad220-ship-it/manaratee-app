import { createClient } from "@/lib/supabase/server"

export type OfferingManageSummary = {
  enrolled: number
  waitlistCount: number
  revenueCollected: number
  /** Any charge rows (paid or unpaid) tied to this offering. */
  chargeCount: number
  /** True when the offering has no registrations and no charges. */
  canDelete: boolean
}

/**
 * Dashboard stats for offering manage Settings (enrollment, waitlist, cash collected).
 */
export async function getOfferingManageSummary(
  offeringId: string,
  organizationId: string
): Promise<OfferingManageSummary> {
  const supabase = await createClient()

  const [enrolledResult, waitlistResult, chargesResult, chargeCountResult, applicationCountResult] =
    await Promise.all([
      supabase
        .from("program_enrollments")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("offering_id", offeringId)
        .in("status", ["enrolled", "active"]),
      supabase
        .from("program_waitlist")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("offering_id", offeringId)
        .in("status", ["waiting", "offered"]),
      supabase
        .from("program_charges")
        .select("amount_paid")
        .eq("organization_id", organizationId)
        .eq("offering_id", offeringId),
      supabase
        .from("program_charges")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("offering_id", offeringId),
      supabase
        .from("program_applications")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("offering_id", offeringId)
        .in("status", ["submitted", "approved"]),
    ])

  if (enrolledResult.error) {
    console.error("getOfferingManageSummary enrolled:", enrolledResult.error.message)
  }
  if (waitlistResult.error) {
    // offering_id may be missing on older waitlist rows — fall back to 0
    console.warn("getOfferingManageSummary waitlist:", waitlistResult.error.message)
  }
  if (chargesResult.error) {
    console.error("getOfferingManageSummary charges:", chargesResult.error.message)
  }
  if (chargeCountResult.error) {
    console.error(
      "getOfferingManageSummary chargeCount:",
      chargeCountResult.error.message
    )
  }
  if (applicationCountResult.error) {
    console.warn(
      "getOfferingManageSummary applications:",
      applicationCountResult.error.message
    )
  }

  const revenueCollected = (chargesResult.data || []).reduce(
    (sum, row) => sum + Number(row.amount_paid || 0),
    0
  )
  const enrolled = enrolledResult.count ?? 0
  const chargeCount = chargeCountResult.count ?? 0
  const applicationCount = applicationCountResult.error
    ? 0
    : applicationCountResult.count ?? 0

  return {
    enrolled,
    waitlistCount: waitlistResult.error ? 0 : waitlistResult.count ?? 0,
    revenueCollected: Math.round(revenueCollected * 100) / 100,
    chargeCount,
    canDelete: enrolled === 0 && chargeCount === 0 && applicationCount === 0,
  }
}
