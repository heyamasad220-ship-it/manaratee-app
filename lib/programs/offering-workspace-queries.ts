import { getOfferingBillingScheduleBundle } from "@/lib/programs/program-billing-queries"
import { getActiveDiscountTags } from "@/lib/programs/program-discount-queries"
import {
  getFeePlanBundleForOffering,
  getInvalidFeePlanLinksForOffering,
} from "@/lib/programs/program-fee-plan-queries"
import type { ProgramOffering } from "@/lib/programs/program-offering-types"
import { getRegistrationQuestionsForOffering } from "@/lib/programs/program-registration-question-actions"
import { getAllRegistrationOptionsForOffering } from "@/lib/programs/program-registration-option-queries"
import { getProgramSessionsForOffering } from "@/lib/programs/program-session-queries"
import { getOfferingScheduleItems } from "@/lib/programs/program-schedule-queries"
import { getStaffAssignmentsForOffering } from "@/lib/programs/program-staff-assignment-queries"
import { getVenues } from "@/lib/bookings/venue-queries"
import type {
  OfferingWorkspaceData,
  OfferingWorkspaceDataMap,
} from "@/lib/programs/offering-workspace-types"

export async function getOfferingWorkspaceData(
  programId: string,
  offering: ProgramOffering,
  organizationId: string
): Promise<OfferingWorkspaceData> {
  const [
    registrationOptions,
    feePlanBundle,
    invalidFeePlanLinks,
    sessions,
    scheduleItems,
    staffAssignments,
    billingSchedule,
    discountTags,
    registrationQuestions,
    venues,
  ] = await Promise.all([
    getAllRegistrationOptionsForOffering(offering.id),
    getFeePlanBundleForOffering(offering.id, organizationId),
    getInvalidFeePlanLinksForOffering(offering.id, organizationId),
    getProgramSessionsForOffering(
      programId,
      offering.id,
      offering.is_default
    ),
    getOfferingScheduleItems(offering.id),
    getStaffAssignmentsForOffering(offering.id, organizationId),
    getOfferingBillingScheduleBundle(programId, organizationId, offering.id, {
      includeParticipants: false,
    }),
    getActiveDiscountTags().catch(() => []),
    getRegistrationQuestionsForOffering(offering.id, organizationId),
    getVenues().catch(() => []),
  ])

  return {
    registrationOptions,
    feePlans: feePlanBundle.plans,
    feePlanComponents: feePlanBundle.components,
    feePlanDiscountRules: feePlanBundle.discountRules,
    invalidFeePlanLinks,
    sessions,
    scheduleItems,
    staffAssignments,
    billingSchedule,
    discountTags: (discountTags || []).map((tag) => ({
      id: tag.id as string,
      name: tag.name as string,
    })),
    registrationQuestions,
    venues: (venues || [])
      .filter((venue) => venue.status === "active")
      .map((venue) => ({ id: venue.id, name: venue.name })),
  }
}

export async function getOfferingWorkspaceDataForProgram(
  programId: string,
  organizationId: string,
  offerings: ProgramOffering[]
): Promise<OfferingWorkspaceDataMap> {
  if (offerings.length === 0) {
    return {}
  }

  const entries = await Promise.all(
    offerings.map(async (offering) => {
      const data = await getOfferingWorkspaceData(
        programId,
        offering,
        organizationId
      )
      return [offering.id, data] as const
    })
  )

  return Object.fromEntries(entries)
}
