"use server"

import {
  getCatalogCapacityByProgramIds,
  getOfferingCountsByProgramIds,
} from "@/lib/programs/program-offering-queries"
import { getPrograms } from "@/lib/programs/program-queries"
import type { ProgramCatalogCapacity } from "@/lib/programs/program-catalog-capacity"
import type { Program } from "@/lib/programs/program-types"

/**
 * Programs Catalog data for one department (same source as `/programs/catalog`).
 */
export async function fetchDepartmentProgramCatalogAction(
  departmentId: string
): Promise<
  | {
      success: true
      programs: Program[]
      offeringCounts: Record<string, number>
      capacityByProgramId: Record<string, ProgramCatalogCapacity>
    }
  | { success: false; error: string }
> {
  try {
    const allPrograms = await getPrograms()
    const programs = allPrograms.filter(
      (program) => program.department_id === departmentId
    )
    const ids = programs.map((program) => program.id)
    const [offeringCountMap, capacityMap] = await Promise.all([
      getOfferingCountsByProgramIds(ids),
      getCatalogCapacityByProgramIds(ids),
    ])

    const offeringCounts: Record<string, number> = {}
    const capacityByProgramId: Record<string, ProgramCatalogCapacity> = {}
    for (const id of ids) {
      offeringCounts[id] = offeringCountMap.get(id) || 0
      const capacity = capacityMap.get(id)
      if (capacity) capacityByProgramId[id] = capacity
    }

    return {
      success: true,
      programs,
      offeringCounts,
      capacityByProgramId,
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not load department programs.",
    }
  }
}
