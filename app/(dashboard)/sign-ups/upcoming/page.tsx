"use client"

import { Header } from "@/components/layout/header"
import { SignUpsTabNav } from "@/components/layout/sign-ups-tab-nav"
import { UpcomingSignUpsTable } from "@/components/sign-ups/upcoming/upcoming-sign-ups-table"

export default function SignUpsUpcomingPage() {
  return (
    <>
      <Header title="Sign-Ups" />
      <SignUpsTabNav />
      <UpcomingSignUpsTable />
    </>
  )
}
