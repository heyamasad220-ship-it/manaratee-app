"use client"

import { Header } from "@/components/layout/header"
import { SignUpsTabNav } from "@/components/layout/sign-ups-tab-nav"
import { PreviousSignUpsTable } from "@/components/sign-ups/previous/previous-sign-ups-table"

export default function SignUpsPreviousPage() {
  return (
    <>
      <Header title="Sign-Ups" />
      <SignUpsTabNav />
      <PreviousSignUpsTable />
    </>
  )
}
