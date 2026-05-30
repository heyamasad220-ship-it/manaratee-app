import { notFound } from "next/navigation"

import { Header } from "@/components/layout/header"
import { createClient } from "@/lib/supabase/server"
import { getDepartments } from "@/lib/departments/department-queries"
import { getProgramById } from "@/lib/programs/program-queries"

import { EditProgramForm } from "./edit-program-form"

export default async function EditProgramPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [program, departments, feeOptionsResult] = await Promise.all([
    getProgramById(id),
    getDepartments(),
    supabase
      .from("program_fee_options")
      .select("*")
      .eq("program_id", id)
      .order("sort_order", { ascending: true }),
  ])

  if (!program) {
    notFound()
  }

  return (
    <>
      <Header title="Programs" />
      <EditProgramForm
        program={program}
        departments={departments}
        feeOptions={feeOptionsResult.data || []}
      />
    </>
  )
}