import { Header } from "@/components/layout/header"
import { VolunteersList } from "@/components/people/volunteers-list"

export default function VolunteersPage() {
  return (
    <>
      <Header title="People" />
      <VolunteersList />
    </>
  )
}
