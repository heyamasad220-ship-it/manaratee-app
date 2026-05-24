import { Header } from "@/components/layout/header"
import { getDepartments } from "@/lib/departments/department-queries"

import { CreateProgramForm } from "./create-program-form"

export default async function CreateProgramPage() {
  const departments = await getDepartments()

  return (
    <>
      <Header title="Programs" />
      <CreateProgramForm departments={departments} />
    </>
  )
}