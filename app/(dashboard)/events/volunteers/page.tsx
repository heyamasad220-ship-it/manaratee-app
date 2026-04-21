"use client"

import { Header } from "@/components/layout/header"
import { VolunteersList } from "@/components/people/volunteers-list"

export default function EventsVolunteersPage() {
  return (
    <>
      <Header title="Volunteers" />
      <VolunteersList />
    </>
  )
}
