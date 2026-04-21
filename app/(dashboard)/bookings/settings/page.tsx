"use client"

import dynamic from "next/dynamic"
import { Header } from "@/components/layout/header"

const BookingsSettings = dynamic(
  () =>
    import("@/components/bookings/settings/bookings-settings").then(
      (mod) => mod.BookingsSettings
    ),
  { ssr: false }
)

export default function BookingsSettingsPage() {
  return (
    <>
      <Header title="Bookings Settings" />
      <div className="flex flex-col gap-5 p-6">
        <BookingsSettings />
      </div>
    </>
  )
}
