"use client"

import { Header } from "@/components/layout/header"
import { SignUpsTable } from "@/components/sign-ups/overview/sign-ups-table"

export default function SignUpsOverviewPage() {
  return (
    <>
      <Header title="Sign-Ups" />
      <div className="flex flex-1 flex-col gap-5 p-6">
        <SignUpsTable />
      </div>
    </>
  )
}
