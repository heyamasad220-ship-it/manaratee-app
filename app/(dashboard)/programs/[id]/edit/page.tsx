import { notFound } from "next/navigation"

import { Header } from "@/components/layout/header"
import { getDepartments } from "@/lib/departments/department-queries"
import { getProgramById } from "@/lib/programs/program-queries"

import { EditProgramForm } from "./edit-program-form"

export default async function EditProgramPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [program, departments] = await Promise.all([
    getProgramById(id),
    getDepartments(),
  ])

  if (!program) {
    notFound()
  }

  return (
    <>
      <Header title="Programs" />
      <EditProgramForm program={program} departments={departments} />
    </>
  )
}