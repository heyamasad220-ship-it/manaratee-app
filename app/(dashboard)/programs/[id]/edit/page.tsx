import { notFound } from "next/navigation"

import { Header } from "@/components/layout/header"
import { createClient } from "@/lib/supabase/server"
import { getDepartments } from "@/lib/departments/department-queries"
import { getProgramById } from "@/lib/programs/program-queries"
import { getProgramCapacityGroups } from "@/lib/programs/program-capacity-group-queries"
import { getProgramSessions } from "@/lib/programs/program-session-queries"
import { getDefaultOfferingForProgram } from "@/lib/programs/program-offering-queries"
import { getAllRegistrationOptionsForOffering } from "@/lib/programs/program-registration-option-queries"
import { getFeePlanBundleForOffering, getInvalidFeePlanLinksForOffering } from "@/lib/programs/program-fee-plan-queries"
import type { ProgramOffering } from "@/lib/programs/program-offering-types"

import { EditProgramForm } from "./edit-program-form"

export default async function EditProgramPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [program, departments, feeOptionsResult, capacityGroups, sessions] =
    await Promise.all([
      getProgramById(id),
      getDepartments(),
      supabase
        .from("program_fee_options")
        .select("*")
        .eq("program_id", id)
        .order("sort_order", { ascending: true }),
      getProgramCapacityGroups(id),
      getProgramSessions(id),
    ])

  if (!program) {
    notFound()
  }

  const defaultOffering = await getDefaultOfferingForProgram(id)
  const registrationOptions = defaultOffering
    ? await getAllRegistrationOptionsForOffering(defaultOffering.id)
    : []
  const feePlanBundle = defaultOffering
    ? await getFeePlanBundleForOffering(defaultOffering.id, program.organization_id)
    : { plans: [], components: [], discountRules: [] }
  const invalidFeePlanLinks = defaultOffering
    ? await getInvalidFeePlanLinksForOffering(
        defaultOffering.id,
        program.organization_id
      )
    : []

  if (invalidFeePlanLinks.length > 0) {
    console.warn(
      "[program-fee-plans] Invalid fee_plan_id on registration options:",
      invalidFeePlanLinks.map((link) => ({
        programId: id,
        offeringId: defaultOffering?.id,
        ...link,
      }))
    )
  }

  return (
    <>
      <Header title="Programs" />
      <EditProgramForm
        program={program}
        departments={departments}
        feeOptions={feeOptionsResult.data || []}
        capacityGroups={capacityGroups}
        sessions={sessions}
        registrationOptions={registrationOptions}
        defaultOffering={defaultOffering}
        feePlans={feePlanBundle.plans}
        feePlanComponents={feePlanBundle.components}
        feePlanDiscountRules={feePlanBundle.discountRules}
        invalidFeePlanLinks={invalidFeePlanLinks}
      />
    </>
  )
}