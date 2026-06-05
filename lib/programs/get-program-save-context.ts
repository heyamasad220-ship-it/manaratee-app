"use server"

import { getProgramById } from "@/lib/programs/program-queries"
import { getDefaultOfferingForProgram } from "@/lib/programs/program-offering-queries"
import type { Program } from "@/lib/programs/program-types"

export async function getProgramSaveContext(programId: string): Promise<{
  program: Program
  offeringId: string | null
}> {
  const program = await getProgramById(programId)

  if (!program) {
    throw new Error("Program not found after creation.")
  }

  const defaultOffering = await getDefaultOfferingForProgram(programId)

  return {
    program,
    offeringId: defaultOffering?.id ?? null,
  }
}
