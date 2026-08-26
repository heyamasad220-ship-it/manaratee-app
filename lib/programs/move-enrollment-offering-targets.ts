import {
  formatMoveOfferingTargetLabel,
  type MoveOfferingTarget,
} from "@/lib/programs/move-enrollment-offering-shared"
import { isOfferingAvailableAsMoveTarget } from "@/lib/programs/program-offering-display"
import { getOfferingsForProgram } from "@/lib/programs/program-offering-queries"
import {
  getEnrollmentCountsByOfferingIds,
  getPrimaryInstructorByOfferingIds,
} from "@/lib/programs/program-staff-assignment-queries"

export async function listMoveOfferingTargets(
  programId: string,
  organizationId: string,
  excludeOfferingId?: string | null
): Promise<MoveOfferingTarget[]> {
  const offerings = await getOfferingsForProgram(programId)
  const candidates = offerings.filter(
    (offering) =>
      isOfferingAvailableAsMoveTarget(offering.status) &&
      offering.id !== excludeOfferingId
  )
  if (candidates.length === 0) return []

  const offeringIds = candidates.map((offering) => offering.id)
  const [instructors, counts] = await Promise.all([
    getPrimaryInstructorByOfferingIds(offeringIds, organizationId),
    getEnrollmentCountsByOfferingIds(offeringIds, organizationId),
  ])

  return candidates.map((offering) => {
    const capacity =
      offering.capacity_mode === "limited"
        ? Math.max(0, Number(offering.capacity || 0))
        : null
    return {
      id: offering.id,
      name: formatMoveOfferingTargetLabel({
        name: offering.name,
        instructor: instructors.get(offering.id) || null,
        enrolled: counts.get(offering.id) ?? 0,
        capacity: capacity && capacity > 0 ? capacity : null,
      }),
    }
  })
}
