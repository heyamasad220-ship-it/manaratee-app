import { Suspense } from "react"
import { Header } from "@/components/layout/header"
import { VolunteersList } from "@/components/workforce/volunteers-list"

export default function HrVolunteersPage() {
  return (
    <>
      <Header title="Volunteers" />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted" />}>
        <VolunteersList />
      </Suspense>
    </>
  )
}
