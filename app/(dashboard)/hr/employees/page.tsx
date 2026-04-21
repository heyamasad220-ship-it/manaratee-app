import { Header } from "@/components/layout/header"
import { EmployeesList } from "@/components/people/employees-list"

export default function EmployeesPage() {
  return (
    <>
      <Header title="People" />
      <EmployeesList />
    </>
  )
}
